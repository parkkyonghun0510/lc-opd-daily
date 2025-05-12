from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from pydantic import ValidationError # For potential validation errors in token payload

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.services import user_service # Import the user service
from app.db.models import User # Import the User model
from typing import Any # For type hinting

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login" # Assuming login endpoint will be /api/auth/login
)

async def get_current_user( # Renamed from get_current_user_placeholder
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User: # Return type is now User model
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    user = await user_service.get_user_by_id(db, user_id=user_id)
    if user is None:
        raise credentials_exception
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
