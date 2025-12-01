import fitz
from bs4 import BeautifulSoup
import aiohttp
from pathlib import Path
from typing import Optional


class DocumentProcessor:

    @staticmethod
    async def extract_pdf_text(file_path: Path) -> str:
        doc = fitz.open(file_path)
        text_parts = []

        for page in doc:
            text = page.get_text()
            text_parts.append(text)

        doc.close()
        return "\n\n".join(text_parts)

    @staticmethod
    async def scrape_url(url: str) -> tuple[str, str]:
        async with aiohttp.ClientSession() as session:
            async with session.get(str(url)) as response:
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')

                for script in soup(["script", "style", "nav", "footer", "header"]):
                    script.decompose()

                title = soup.find('title')
                title_text = title.get_text().strip() if title else "Web Document"

                text = soup.get_text(separator='\n', strip=True)

                lines = [line.strip() for line in text.splitlines() if line.strip()]
                cleaned_text = '\n'.join(lines)

                return title_text, cleaned_text

    @staticmethod
    def validate_file_type(filename: str, allowed_extensions: set = {'.pdf'}) -> bool:
        return Path(filename).suffix.lower() in allowed_extensions

    @staticmethod
    def clean_text(text: str) -> str:
        lines = text.split('\n')
        cleaned_lines = []

        for line in lines:
            line = line.strip()
            if len(line) > 0:
                cleaned_lines.append(line)

        return '\n'.join(cleaned_lines)
