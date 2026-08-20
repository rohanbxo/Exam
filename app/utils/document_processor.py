from __future__ import annotations

import asyncio
import re
from pathlib import Path

import fitz
import httpx
from bs4 import BeautifulSoup
from docx import Document as DocxDocument

from app.config import settings


ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}
USER_AGENT = "Mozilla/5.0 (compatible; StudysonBot/1.0; +https://github.com/)"


class DocumentProcessor:
    @staticmethod
    def validate_file_type(filename: str) -> bool:
        return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS

    @staticmethod
    async def extract_text(file_path: Path) -> str:
        suffix = file_path.suffix.lower()
        if suffix == ".pdf":
            return await asyncio.to_thread(DocumentProcessor._extract_pdf, file_path)
        if suffix == ".docx":
            return await asyncio.to_thread(DocumentProcessor._extract_docx, file_path)
        if suffix in {".txt", ".md"}:
            return await asyncio.to_thread(
                file_path.read_text, encoding="utf-8", errors="replace"
            )
        raise ValueError(f"Unsupported file type: {suffix}")

    @staticmethod
    def _extract_pdf(file_path: Path) -> str:
        with fitz.open(str(file_path)) as doc:
            return "\n\n".join(page.get_text() for page in doc)

    @staticmethod
    def _extract_docx(file_path: Path) -> str:
        document = DocxDocument(str(file_path))
        return "\n".join(p.text for p in document.paragraphs if p.text)

    @staticmethod
    async def scrape_url(url: str) -> tuple[str, str]:
        timeout = httpx.Timeout(settings.scrape_timeout_seconds)
        headers = {"User-Agent": USER_AGENT, "Accept": "text/html,*/*"}

        async with httpx.AsyncClient(
            timeout=timeout,
            headers=headers,
            follow_redirects=True,
            max_redirects=5,
        ) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                content_type = response.headers.get("content-type", "")
                if "html" not in content_type and "text" not in content_type:
                    raise ValueError(f"Unsupported content-type: {content_type}")

                chunks: list[bytes] = []
                total = 0
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > settings.max_scrape_bytes:
                        raise ValueError(
                            f"Page exceeds {settings.max_scrape_bytes} byte limit"
                        )
                    chunks.append(chunk)
                html = b"".join(chunks).decode(
                    response.encoding or "utf-8", errors="replace"
                )

        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
            tag.decompose()

        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else "Web Document"

        text = soup.get_text(separator="\n", strip=True)
        return title, text

    @staticmethod
    def clean_text(text: str) -> str:
        text = re.sub(r"[ \t]+", " ", text)
        lines = (line.strip() for line in text.splitlines())
        return "\n".join(line for line in lines if line)
