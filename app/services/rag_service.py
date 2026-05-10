import os
from typing import AsyncGenerator, List, Optional
from threading import Lock

import chromadb
from llama_index.core import Document, Settings, StorageContext, VectorStoreIndex
from llama_index.core.chat_engine.types import BaseChatEngine
from llama_index.embeddings.fastembed import FastEmbedEmbedding
from llama_index.llms.groq import Groq
from llama_index.vector_stores.chroma import ChromaVectorStore

from app.config import settings
from app.models.schemas import SourceInfo


_llm_lock = Lock()
_llm_initialized = False


def _ensure_llm() -> None:
    global _llm_initialized
    with _llm_lock:
        if _llm_initialized:
            return
        os.environ["GROQ_API_KEY"] = settings.groq_api_key
        Settings.llm = Groq(model=settings.groq_model, api_key=settings.groq_api_key)
        Settings.embed_model = FastEmbedEmbedding(model_name=settings.embed_model)
        _llm_initialized = True


class RAGService:
    """Persistent, multi-session RAG service backed by Chroma."""

    def __init__(self) -> None:
        settings.chroma_dir.mkdir(parents=True, exist_ok=True)
        self._chroma = chromadb.PersistentClient(path=str(settings.chroma_dir))
        self._collection = self._chroma.get_or_create_collection("studyson")
        self._vector_store = ChromaVectorStore(chroma_collection=self._collection)
        self._storage = StorageContext.from_defaults(vector_store=self._vector_store)
        self._index: Optional[VectorStoreIndex] = None
        self._chat_engines: dict[str, BaseChatEngine] = {}
        self._indexed_documents: list[str] = self._load_indexed_documents()

    def _load_indexed_documents(self) -> list[str]:
        try:
            data = self._collection.get(include=["metadatas"])
            sources = {m.get("source") for m in (data.get("metadatas") or []) if m}
            return sorted(s for s in sources if s)
        except Exception:
            return []

    def _ensure_index(self) -> VectorStoreIndex:
        _ensure_llm()
        if self._index is None:
            self._index = VectorStoreIndex.from_vector_store(
                vector_store=self._vector_store,
                storage_context=self._storage,
            )
        return self._index

    def add_document(self, text: str, source_name: str) -> None:
        index = self._ensure_index()
        document = Document(text=text, metadata={"source": source_name})
        index.insert(document)
        if source_name not in self._indexed_documents:
            self._indexed_documents.append(source_name)
        self._chat_engines.clear()

    def _get_chat_engine(self, session_id: str) -> BaseChatEngine:
        engine = self._chat_engines.get(session_id)
        if engine is None:
            index = self._ensure_index()
            engine = index.as_chat_engine(
                chat_mode="condense_plus_context",
                similarity_top_k=settings.similarity_top_k,
                verbose=False,
            )
            self._chat_engines[session_id] = engine
        return engine

    async def stream_query(
        self, question: str, session_id: str
    ) -> AsyncGenerator[str, None]:
        if not self.has_documents():
            raise ValueError("No documents indexed.")
        engine = self._get_chat_engine(session_id)
        response = await engine.astream_chat(question)
        async for token in response.async_response_gen():
            yield token

    async def query(self, question: str) -> tuple[str, List[SourceInfo]]:
        if not self.has_documents():
            raise ValueError("No documents indexed.")
        index = self._ensure_index()
        query_engine = index.as_query_engine(similarity_top_k=settings.similarity_top_k)
        response = await query_engine.aquery(question)
        sources: list[SourceInfo] = []
        for node in getattr(response, "source_nodes", []) or []:
            sources.append(
                SourceInfo(
                    file_name=node.metadata.get("source", "Unknown"),
                    text=node.text[:300],
                    score=getattr(node, "score", None),
                )
            )
        return str(response), sources

    async def summarize(self, max_length: int = 500) -> str:
        if not self.has_documents():
            raise ValueError("No documents indexed.")
        index = self._ensure_index()
        query_engine = index.as_query_engine(similarity_top_k=8)
        prompt = (
            f"Provide a comprehensive summary of all indexed documents in approximately "
            f"{max_length} words. Cover the main ideas, key arguments, and important details. "
            f"Use clear paragraphs."
        )
        response = await query_engine.aquery(prompt)
        return str(response)

    def reset_session(self, session_id: str) -> None:
        self._chat_engines.pop(session_id, None)

    def reset_all(self) -> None:
        try:
            self._chroma.delete_collection("studyson")
        except Exception:
            pass
        self._collection = self._chroma.get_or_create_collection("studyson")
        self._vector_store = ChromaVectorStore(chroma_collection=self._collection)
        self._storage = StorageContext.from_defaults(vector_store=self._vector_store)
        self._index = None
        self._chat_engines.clear()
        self._indexed_documents = []

    def get_indexed_documents(self) -> List[str]:
        return list(self._indexed_documents)

    def has_documents(self) -> bool:
        try:
            return self._collection.count() > 0
        except Exception:
            return bool(self._indexed_documents)
