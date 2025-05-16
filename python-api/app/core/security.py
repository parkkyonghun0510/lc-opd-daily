from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional, Dict
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
# Default refresh token expiration (7 days)
REFRESH_TOKEN_EXPIRE_DAYS = getattr(settings, "REFRESH_TOKEN_EXPIRE_DAYS", 7)

def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    extra_data: Optional[dict] = None
) -> str:
    """
    Create a JWT access token with user information.

    Args:
        subject: The subject of the token (usually user ID)
        expires_delta: Optional custom expiration time
        extra_data: Additional data to include in the token (role, branch IDs, etc.)

    Returns:
        Encoded JWT token string
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    # Base token data
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "access",
        "iat": datetime.now(timezone.utc)  # Issued at time
    }

    # Add any extra data (role, permissions, etc.)
    if extra_data:
        to_encode.update(extra_data)

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    extra_data: Optional[dict] = None
) -> str:
    """
    Create a refresh token with a longer expiration period.
    This token is used to get a new access token without requiring
    the user to provide credentials again.

    Args:
        subject: The subject of the token (usually user ID)
        expires_delta: Optional custom expiration time
        extra_data: Additional data to include in the token

    Returns:
        Encoded JWT refresh token string
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    # Base token data
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "refresh",
        "iat": datetime.now(timezone.utc)  # Issued at time
    }

    # Add any extra data if provided
    if extra_data:
        to_encode.update(extra_data)

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_refresh_token(token: str) -> Optional[str]:
    """
    Verify the refresh token and return the subject (typically user_id)
    if the token is valid, otherwise return None.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        # Check if it's a refresh token
        if payload.get("type") != "refresh":
            return None
        subject = payload.get("sub")
        return subject
    except JWTError:
        return None

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        # Optionally verify it's an access token
        if "type" in payload and payload["type"] != "access":
            return None
        return payload
    except JWTError:
        return None
