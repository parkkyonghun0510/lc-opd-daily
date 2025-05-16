from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
import logging

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.services import user_service # Import the user service
from app.db.models import User # Import the User model
from typing import Any, Dict, Optional # For type hinting

# Set up logging
logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login" # Assuming login endpoint will be /api/auth/login
)

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT token.

    Args:
        token: The JWT token to decode

    Returns:
        The decoded token payload or None if invalid
    """
    try:
        # Use the algorithm from settings
        algorithm = settings.JWT_ALGORITHM
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[algorithm]
        )
        return payload
    except JWTError:
        return None

async def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """
    Get the current user from the JWT token.

    This function validates the JWT token and returns the corresponding user.
    If the token contains role information, it will be used to optimize database queries.

    Args:
        db: Database session
        token: JWT token from Authorization header

    Returns:
        The current authenticated user

    Raises:
        HTTPException: If the token is invalid or the user doesn't exist
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Decode and validate the token
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    # Extract user ID from token
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    # Get user from database
    user = await user_service.get_user_by_id(db, user_id=user_id)
    if user is None:
        raise credentials_exception

    # If token contains role information, use it to optimize
    token_role = payload.get("role")
    if token_role and user.role != token_role:
        # Log potential token tampering
        logger.warning(f"Token role ({token_role}) doesn't match database role ({user.role}) for user {user_id}")

    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user) # Parameter type is now User
) -> User: # Return type is now User
    if not user_service.is_active(current_user):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user

# Dependency for superuser (admin)
async def get_current_active_superuser(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if not user_service.is_superuser(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="The user doesn't have enough privileges"
        )
    return current_user
