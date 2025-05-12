from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class RefreshTokenBase(BaseModel):
    """
    Base schema for refresh token.
    """
    token: str
    userId: str
    expiresAt: datetime
    isRevoked: bool = False


class RefreshTokenCreate(RefreshTokenBase):
    """
    Schema for creating a refresh token.
    """
    id: str


class RefreshTokenUpdate(BaseModel):
    """
    Schema for updating a refresh token.
    """
    token: Optional[str] = None
    expiresAt: Optional[datetime] = None
    isRevoked: Optional[bool] = None


class RefreshTokenInDBBase(RefreshTokenBase):
    """
    Base schema for refresh token in database.
    """
    id: str
    createdAt: datetime

    model_config = {
        "from_attributes": True
    }


class RefreshToken(RefreshTokenInDBBase):
    """
    Schema for refresh token response.
    """
    pass


class RefreshTokenInDB(RefreshTokenInDBBase):
    """
    Schema for refresh token in database.
    """
    pass
