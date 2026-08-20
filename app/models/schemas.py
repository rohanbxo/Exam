from typing import List, Optional

from pydantic import BaseModel, Field, HttpUrl


class ScrapeRequest(BaseModel):
    url: HttpUrl
    session_id: Optional[str] = None


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None


class SourceInfo(BaseModel):
    file_name: str
    text: str
    score: Optional[float] = None


class FinalResponse(BaseModel):
    final_answer: str
    sources: List[SourceInfo]


class SummarizeRequest(BaseModel):
    max_length: int = Field(default=500, ge=50, le=2000)
    style: str = "concise"


class SummaryResponse(BaseModel):
    summary: str
    word_count: int
    source_documents: List[str]


class StatusResponse(BaseModel):
    status: str
    message: str
    details: Optional[dict] = None


class DeleteDocumentResponse(BaseModel):
    status: str
    message: str
    deleted: str
    indexed_documents: List[str]


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str
    sources: Optional[List[SourceInfo]] = None
    created_at: str


class SessionSummary(BaseModel):
    session_id: str
    title: Optional[str] = None
    created_at: str
    updated_at: str
    message_count: int


class SessionMessagesResponse(BaseModel):
    session_id: str
    messages: List[ChatMessage]


class RenameSessionRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
