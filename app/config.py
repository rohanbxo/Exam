from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    groq_api_key: str
    groq_model: str = "openai/gpt-oss-120b"
    embed_model: str = "BAAI/bge-small-en-v1.5"

    host: str = "0.0.0.0"
    port: int = 7860

    upload_dir: Path = Path("uploads")
    chroma_dir: Path = Path("chroma_store")
    history_db_name: str = "history.db"

    max_file_size: int = 20 * 1024 * 1024
    max_scrape_bytes: int = 5 * 1024 * 1024
    scrape_timeout_seconds: float = 15.0

    similarity_top_k: int = 4
    # Kept low so a summarize request fits inside Groq's free-tier
    # token-per-minute budget; raise it on a paid tier.
    summarize_top_k: int = 4

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
