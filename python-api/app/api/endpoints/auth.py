from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm # For form data login
from sqlalchemy.orm import Session
from datetime import timedelta

from app.api import deps # Dependency functions (get_db, get_current_user)
from app.core.config import settings
from app.core.security import create_access_token
from app.schemas import User as UserSchema, Token as TokenSchema, UserLogin # Pydantic schemas
from app.services import user_service # User service functions

router = APIRouter()

@router.post("/login", response_model=TokenSchema)
async def login_for_access_token(
    db: Session = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends() # Using form data for login
):
    """
    OAuth2 compatible token login, get an access token for future requests.
    Takes username and password from form data.
    """
    user = await user_service.authenticate_user(
        db, username_or_email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    elif not user_service.is_active(user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive user"
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login/json", response_model=TokenSchema, summary="Login with JSON payload")
async def login_for_access_token_json(
    user_credentials: UserLogin, # Using JSON body for login
    db: Session = Depends(deps.get_db)
):
    """
    Alternative login endpoint that accepts a JSON payload.
    """
    user = await user_service.authenticate_user(
        db, username_or_email=user_credentials.username, password=user_credentials.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    elif not user_service.is_active(user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserSchema)
async def read_users_me(
    current_user: UserSchema = Depends(deps.get_current_active_user)
):
    """
    Get current authenticated user.
    """
    # The current_user object from deps.get_current_active_user is already an instance
    # of the User model (SQLAlchemy model). Pydantic will automatically serialize it
    # based on the UserSchema.
    return current_user

# TODO: Add routes for password recovery, email verification, etc. if needed.
