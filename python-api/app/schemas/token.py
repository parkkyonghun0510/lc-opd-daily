from pydantic import BaseModel
from typing import Optional


class Token(BaseModel):
    """
    Schema for token response.
    """
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str


class TokenPayload(BaseModel):
    """
    Schema for token payload in requests.
    """
    refresh_token: str
