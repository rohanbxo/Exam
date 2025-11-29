from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    google_api_key: str
    host: str = "0.0.0.0"
    port: int = 8000
    upload_dir: Path = Path("uploads")
    max_file_size: int = 10 * 1024 * 1024

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


settings = Settings()
