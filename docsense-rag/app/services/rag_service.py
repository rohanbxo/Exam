from llama_index.core import VectorStoreIndex, Document, Settings
from llama_index.llms.gemini import Gemini
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core.chat_engine import CondensePlusContextChatEngine
from typing import Optional, AsyncGenerator, List
from app.config import settings
from app.models.schemas import SourceInfo
import os


class RAGService:

    def __init__(self):
        os.environ["GOOGLE_API_KEY"] = settings.google_api_key
        self._llm_initialized = False
        self.index: Optional[VectorStoreIndex] = None
        self.chat_engine = None
        self.indexed_documents = []

    def _initialize_llm(self):
        if not self._llm_initialized:
            Settings.llm = Gemini(model="models/gemini-2.5-flash")
            # Use local HuggingFace embeddings to avoid API quota limits
            Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")
            self._llm_initialized = True

    def create_index_from_text(self, text: str, source_name: str) -> None:
        self._initialize_llm()
        document = Document(text=text, metadata={"source": source_name})
        self.indexed_documents.append(source_name)

        if self.index is None:
            self.index = VectorStoreIndex.from_documents([document])
        else:
            self.index.insert(document)

        self.chat_engine = self.index.as_chat_engine(
            chat_mode="condense_plus_context",
            verbose=True
        )

    def create_index_from_documents(self, documents: List[Document]) -> None:
        self._initialize_llm()
        for doc in documents:
            if "source" in doc.metadata:
                self.indexed_documents.append(doc.metadata["source"])

        if self.index is None:
            self.index = VectorStoreIndex.from_documents(documents)
        else:
            for doc in documents:
                self.index.insert(doc)

        self.chat_engine = self.index.as_chat_engine(
            chat_mode="condense_plus_context",
            verbose=True
        )

    async def stream_query(self, question: str) -> AsyncGenerator[str, None]:
        if self.chat_engine is None:
            raise ValueError("No documents indexed. Please upload a document first.")

        response = await self.chat_engine.astream_chat(question)

        async for token in response.async_response_gen():
            yield token

    async def query(self, question: str) -> tuple[str, List[SourceInfo]]:
        if self.index is None:
            raise ValueError("No documents indexed. Please upload a document first.")

        query_engine = self.index.as_query_engine(similarity_top_k=3)
        response = await query_engine.aquery(question)

        sources = []
        if hasattr(response, 'source_nodes'):
            for node in response.source_nodes:
                source_info = SourceInfo(
                    file_name=node.metadata.get("source", "Unknown"),
                    text=node.text[:300],
                    score=node.score if hasattr(node, 'score') else None
                )
                sources.append(source_info)

        return str(response), sources

    async def summarize(self, max_length: int = 500) -> str:
        if self.index is None:
            raise ValueError("No documents indexed. Please upload a document first.")

        query_engine = self.index.as_query_engine()

        summary_prompt = f"Provide a comprehensive summary of all the documents in approximately {max_length} words. Focus on the main ideas, key points, and important details."

        response = await query_engine.aquery(summary_prompt)
        return str(response)

    def reset_index(self) -> None:
        self.index = None
        self.chat_engine = None
        self.indexed_documents = []

    def get_indexed_documents(self) -> List[str]:
        return self.indexed_documents

    def has_documents(self) -> bool:
        return self.index is not None
