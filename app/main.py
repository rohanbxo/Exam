import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.models.schemas import (
    ChatMessage,
    DeleteDocumentResponse,
    FinalResponse,
    QueryRequest,
    RenameSessionRequest,
    ScrapeRequest,
    SessionMessagesResponse,
    SessionSummary,
    StatusResponse,
    SummarizeRequest,
    SummaryResponse,
)
from app.services.history_service import HistoryService
from app.services.rag_service import RAGService
from app.utils.document_processor import ALLOWED_EXTENSIONS, DocumentProcessor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("studyson")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.chroma_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Studyson starting | model=%s | chroma=%s", settings.groq_model, settings.chroma_dir)

    # Warm the embedding model at startup so the first user request doesn't
    # pay the model-load cost (several seconds on a cold container).
    await asyncio.to_thread(rag_service.warm_up)
    logger.info("Embedding model warm | embed_model=%s", settings.embed_model)

    yield


app = FastAPI(
    title="Studyson RAG API",
    description="Document QA and summarization using RAG (Groq + LlamaIndex + Chroma)",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_service = RAGService()
doc_processor = DocumentProcessor()
history_service = HistoryService(settings.chroma_dir / settings.history_db_name)

app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")


@app.post("/upload", response_model=StatusResponse)
async def upload_document(file: UploadFile = File(...)):
    if not file.filename or not doc_processor.validate_file_type(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    if file.size and file.size > settings.max_file_size:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds {settings.max_file_size // (1024 * 1024)} MB limit",
        )

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = file.filename.replace("/", "_").replace("\\", "_")
    file_path = settings.upload_dir / safe_name

    try:
        content = await file.read()
        if len(content) > settings.max_file_size:
            raise HTTPException(status_code=400, detail="File exceeds size limit")
        file_path.write_bytes(content)

        text = await doc_processor.extract_text(file_path)
        cleaned_text = doc_processor.clean_text(text)
        if not cleaned_text.strip():
            raise HTTPException(status_code=400, detail="No extractable text in file")

        rag_service.add_document(cleaned_text, safe_name)

        return StatusResponse(
            status="success",
            message=f"Document '{safe_name}' indexed successfully",
            details={
                "filename": safe_name,
                "text_length": len(cleaned_text),
                "indexed_documents": rag_service.get_indexed_documents(),
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Upload failed for %s", file.filename)
        if file_path.exists():
            file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Error processing document: {e}")


@app.post("/scrape_and_index", response_model=StatusResponse)
async def scrape_and_index(request: ScrapeRequest):
    try:
        title, text = await doc_processor.scrape_url(str(request.url))
        cleaned_text = doc_processor.clean_text(text)
        if not cleaned_text.strip():
            raise HTTPException(status_code=400, detail="No extractable text on page")

        rag_service.add_document(cleaned_text, title)

        return StatusResponse(
            status="success",
            message="URL content indexed successfully",
            details={
                "url": str(request.url),
                "title": title,
                "text_length": len(cleaned_text),
                "indexed_documents": rag_service.get_indexed_documents(),
            },
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Scrape failed for %s", request.url)
        raise HTTPException(status_code=500, detail=f"Error scraping URL: {e}")


@app.delete("/documents/{document_name}", response_model=DeleteDocumentResponse)
async def delete_document(document_name: str):
    try:
        rag_service.delete_document(document_name)
        file_path = settings.upload_dir / document_name
        if file_path.exists() and file_path.is_file():
            file_path.unlink(missing_ok=True)
        return DeleteDocumentResponse(
            status="success",
            message=f"Document '{document_name}' removed",
            deleted=document_name,
            indexed_documents=rag_service.get_indexed_documents(),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Delete failed for %s", document_name)
        raise HTTPException(status_code=500, detail=f"Error deleting document: {e}")


def _resolve_session(session_id: str | None) -> str:
    return session_id or str(uuid.uuid4())


@app.post("/stream_query")
async def stream_query(request: QueryRequest):
    if not rag_service.has_documents():
        raise HTTPException(status_code=400, detail="No documents indexed. Please upload a document first.")

    session_id = _resolve_session(request.session_id)

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            yield f"data: {json.dumps({'session_id': session_id})}\n\n"

            try:
                await asyncio.to_thread(history_service.add_message, session_id, "user", request.question)
            except Exception:
                logger.exception("Failed to persist user message for session %s", session_id)

            answer_parts: list[str] = []
            async for token in rag_service.stream_query(request.question, session_id):
                answer_parts.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"

            full_answer = "".join(answer_parts)
            sources = await rag_service.retrieve_sources(request.question)

            final = FinalResponse(
                final_answer=full_answer,
                sources=[s.model_dump() for s in sources],
            )
            yield "data: [DONE]\n\n"
            yield f"data: {json.dumps(final.model_dump())}\n\n"

            try:
                await asyncio.to_thread(
                    history_service.add_message,
                    session_id,
                    "assistant",
                    full_answer,
                    [s.model_dump() for s in sources],
                )
                await asyncio.to_thread(history_service.touch_session, session_id)
            except Exception:
                logger.exception("Failed to persist assistant message for session %s", session_id)
        except Exception as e:
            logger.exception("Stream query failed")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/query", response_model=FinalResponse)
async def query(request: QueryRequest):
    if not rag_service.has_documents():
        raise HTTPException(status_code=400, detail="No documents indexed. Please upload a document first.")
    try:
        answer, sources = await rag_service.query(request.question)
        return FinalResponse(final_answer=answer, sources=sources)
    except Exception as e:
        logger.exception("Query failed")
        raise HTTPException(status_code=500, detail=f"Error processing query: {e}")


@app.post("/summarize", response_model=SummaryResponse)
async def summarize(request: SummarizeRequest):
    if not rag_service.has_documents():
        raise HTTPException(status_code=400, detail="No documents indexed. Please upload a document first.")
    try:
        summary = await rag_service.summarize(max_length=request.max_length)
        return SummaryResponse(
            summary=summary,
            word_count=len(summary.split()),
            source_documents=rag_service.get_indexed_documents(),
        )
    except Exception as e:
        logger.exception("Summarize failed")
        raise HTTPException(status_code=500, detail=f"Error generating summary: {e}")


@app.post("/reset", response_model=StatusResponse)
async def reset_index():
    try:
        rag_service.reset_all()
        if settings.upload_dir.exists():
            for path in settings.upload_dir.glob("*"):
                if path.is_file():
                    path.unlink(missing_ok=True)
        return StatusResponse(status="success", message="Index reset. All documents removed.")
    except Exception as e:
        logger.exception("Reset failed")
        raise HTTPException(status_code=500, detail=f"Error resetting index: {e}")


@app.get("/status", response_model=StatusResponse)
async def get_status():
    docs = rag_service.get_indexed_documents()
    return StatusResponse(
        status="online",
        message="Studyson RAG API is running",
        details={
            "model": settings.groq_model,
            "has_documents": rag_service.has_documents(),
            "indexed_documents": docs,
            "document_count": len(docs),
        },
    )


@app.get("/sessions", response_model=list[SessionSummary])
async def list_sessions():
    return await asyncio.to_thread(history_service.list_sessions)


@app.get("/sessions/{session_id}/messages", response_model=SessionMessagesResponse)
async def get_session_messages(session_id: str):
    messages = await asyncio.to_thread(history_service.get_messages, session_id)
    return SessionMessagesResponse(
        session_id=session_id,
        messages=[ChatMessage(**m) for m in messages],
    )


@app.patch("/sessions/{session_id}", response_model=StatusResponse)
async def rename_session(session_id: str, request: RenameSessionRequest):
    await asyncio.to_thread(history_service.rename_session, session_id, request.title)
    return StatusResponse(status="success", message="Session renamed")


@app.delete("/sessions/{session_id}", response_model=StatusResponse)
async def delete_session(session_id: str):
    await asyncio.to_thread(history_service.delete_session, session_id)
    rag_service.reset_session(session_id)
    return StatusResponse(status="success", message="Session deleted")


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    candidate = Path("static") / full_path
    if full_path and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse("static/index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port)
