import os
from typing import List, Union, Optional
from pydantic import PostgresDsn, validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # API settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "LC OPD Daily API"

    # Generate a new secret key for production
    # openssl rand -hex 32
    SECRET_KEY: str = os.getenv("SECRET_KEY", "a_very_secure_secret_key_for_development_only_please_change_me")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    JWT_ALGORITHM: str = "HS256"
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7  # 7 days

    # Database
    DATABASE_URL: Union[PostgresDsn, str] = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/lc_opd_daily")
    PRISMA_DATABASE_URL: Optional[str] = None

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000") # Comma separated string

    @validator("CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
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
