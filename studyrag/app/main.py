from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json
from typing import AsyncGenerator

from app.config import settings
from app.models.schemas import (
    ScrapeRequest, QueryRequest, FinalResponse,
    StatusResponse, SummarizeRequest, SummaryResponse
)
from app.services.rag_service import RAGService
from app.utils.document_processor import DocumentProcessor

app = FastAPI(
    title="DocSense RAG API",
    description="Document QA and Summarization using RAG",
    version="1.0.0"
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

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def read_root():
    return FileResponse("static/index.html")


@app.post("/upload", response_model=StatusResponse)
async def upload_document(file: UploadFile = File(...)):
    if not doc_processor.validate_file_type(file.filename):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    if file.size and file.size > settings.max_file_size:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit")

    settings.upload_dir.mkdir(exist_ok=True)
    file_path = settings.upload_dir / file.filename

    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        text = await doc_processor.extract_pdf_text(file_path)
        cleaned_text = doc_processor.clean_text(text)

        rag_service.create_index_from_text(cleaned_text, file.filename)

        return StatusResponse(
            status="success",
            message=f"Document '{file.filename}' uploaded and indexed successfully",
            details={
                "filename": file.filename,
                "text_length": len(cleaned_text),
                "indexed_documents": rag_service.get_indexed_documents()
            }
        )

    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")


@app.post("/scrape_and_index", response_model=StatusResponse)
async def scrape_and_index(request: ScrapeRequest):
    try:
        title, text = await doc_processor.scrape_url(str(request.url))
        cleaned_text = doc_processor.clean_text(text)

        rag_service.create_index_from_text(cleaned_text, title)

        return StatusResponse(
            status="success",
            message=f"URL content indexed successfully",
            details={
                "url": str(request.url),
                "title": title,
                "text_length": len(cleaned_text),
                "indexed_documents": rag_service.get_indexed_documents()
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scraping URL: {str(e)}")


@app.post("/stream_query")
async def stream_query(request: QueryRequest):
    if not rag_service.has_documents():
        raise HTTPException(status_code=400, detail="No documents indexed. Please upload a document first.")

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            answer_parts = []

            async for token in rag_service.stream_query(request.question):
                answer_parts.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"

            full_answer = "".join(answer_parts)

            _, sources = await rag_service.query(request.question)

            final_response = FinalResponse(
                final_answer=full_answer,
                sources=[source.model_dump() for source in sources]
            )

            yield f"data: [DONE]\n\n"
            yield f"data: {json.dumps(final_response.model_dump())}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/query", response_model=FinalResponse)
async def query(request: QueryRequest):
    if not rag_service.has_documents():
        raise HTTPException(status_code=400, detail="No documents indexed. Please upload a document first.")

    try:
        answer, sources = await rag_service.query(request.question)

        return FinalResponse(
            final_answer=answer,
            sources=sources
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")


@app.post("/summarize", response_model=SummaryResponse)
async def summarize(request: SummarizeRequest):
    if not rag_service.has_documents():
        raise HTTPException(status_code=400, detail="No documents indexed. Please upload a document first.")

    try:
        summary = await rag_service.summarize(max_length=request.max_length)

        word_count = len(summary.split())

        return SummaryResponse(
            summary=summary,
            word_count=word_count,
            source_documents=rag_service.get_indexed_documents()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")


@app.post("/reset", response_model=StatusResponse)
async def reset_index():
    try:
        rag_service.reset_index()

        # Only try to delete files if uploads directory exists
        if settings.upload_dir.exists():
            for file_path in settings.upload_dir.glob("*"):
                if file_path.is_file():
                    file_path.unlink()

        return StatusResponse(
            status="success",
            message="Index reset successfully. All documents removed."
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resetting index: {str(e)}")


@app.get("/status", response_model=StatusResponse)
async def get_status():
    return StatusResponse(
        status="online",
        message="DocSense RAG API is running",
        details={
            "has_documents": rag_service.has_documents(),
            "indexed_documents": rag_service.get_indexed_documents(),
            "document_count": len(rag_service.get_indexed_documents())
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
