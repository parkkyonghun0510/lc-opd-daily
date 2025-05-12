import os
from typing import List, Union
from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    API_V1_STR: str = "/api"
    # Generate a new secret key for production
    # openssl rand -hex 32
    SECRET_KEY: str = os.getenv("SECRET_KEY", "a_very_secure_secret_key_for_development_only_please_change_me")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    JWT_ALGORITHM: str = "HS256"

    # Database
    DATABASE_URL: Union[PostgresDsn, str] = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/lc_opd_daily")

    # CORS
    CORS_ORIGINS_STR: str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000") # Comma separated string

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return [url.strip() for url in self.CORS_ORIGINS_STR.split(",")]

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding='utf-8',
        extra='ignore'
    )

settings = Settings()
