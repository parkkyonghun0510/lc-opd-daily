from pydantic import BaseModel, Field


class PasswordReset(BaseModel):
    """
    Schema for password reset requests.
    """
    token: str
    new_password: str = Field(..., min_length=6)
