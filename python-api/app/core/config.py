import os
from typing import List, Union, Optional, Any
from pydantic import PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")  # Options: development, production, testing

    # API settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "LC OPD Daily API"

    # Generate a new secret key for production
    # openssl rand -hex 32
    SECRET_KEY: str = os.getenv("SECRET_KEY", "a_very_secure_secret_key_for_development_only_please_change_me")

    # Token settings
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24))  # Default: 1 day
    JWT_ALGORITHM: str = os.getenv("ALGORITHM", "HS256")  # Match the env var name
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7))  # Default: 7 days

    # Database
    DATABASE_URL: Union[PostgresDsn, str] = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/lc_opd_daily")
    PRISMA_DATABASE_URL: Optional[str] = None

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000") # Comma separated string

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return []  # Return empty list as fallback

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding='utf-8',
        extra='ignore'
    )

settings = Settings()
