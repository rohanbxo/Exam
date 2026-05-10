from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    groq_api_key: str
    groq_model: str = "llama-3.3-70b-versatile"
    embed_model: str = "BAAI/bge-small-en-v1.5"

    host: str = "0.0.0.0"
    port: int = 7860

    upload_dir: Path = Path("uploads")
    chroma_dir: Path = Path("chroma_store")

    max_file_size: int = 20 * 1024 * 1024
    max_scrape_bytes: int = 5 * 1024 * 1024
    scrape_timeout_seconds: float = 15.0

    similarity_top_k: int = 4

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
