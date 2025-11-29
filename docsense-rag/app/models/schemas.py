from pydantic import BaseModel, HttpUrl
from typing import List, Optional


class ScrapeRequest(BaseModel):
    url: HttpUrl


class QueryRequest(BaseModel):
    question: str


class SourceInfo(BaseModel):
    file_name: str
    text: str
    score: Optional[float] = None


class FinalResponse(BaseModel):
    final_answer: str
    sources: List[SourceInfo]


class SummarizeRequest(BaseModel):
    max_length: Optional[int] = 500
    style: Optional[str] = "concise"


class SummaryResponse(BaseModel):
    summary: str
    word_count: int
    source_documents: List[str]


class StatusResponse(BaseModel):
    status: str
    message: str
    details: Optional[dict] = None
