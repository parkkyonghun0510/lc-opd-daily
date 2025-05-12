from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
import logging
from typing import Optional

from app.api import deps
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, verify_refresh_token
from app.schemas import User as UserSchema, Token as TokenSchema, UserLogin, TokenPayload, PasswordReset
from app.services import user_service
from app.utils.rate_limit import RateLimiter

# Set up logging
logger = logging.getLogger(__name__)

# Initialize rate limiter (e.g., 5 attempts per minute)
login_limiter = RateLimiter(max_calls=5, time_frame=60)

router = APIRouter()

@router.post("/login", response_model=TokenSchema)
async def login_for_access_token(
    request: Request,
    db: Session = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends() # Using form data for login
):
    """
    OAuth2 compatible token login, get an access token for future requests.
    Takes username and password from form data.
    """
    # Apply rate limiting by client IP
    client_ip = request.client.host
    if not login_limiter.check(client_ip):
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )
    
    try:
        user = await user_service.authenticate_user(
            db, username_or_email=form_data.username, password=form_data.password
        )
        if not user:
            logger.warning(f"Failed login attempt for user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif not user_service.is_active(user):
            logger.warning(f"Login attempt for inactive user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Inactive user"
            )
        
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
        # Create tokens
        access_token = user_service.create_access_token(user_id=user.id)
        refresh_token = user_service.create_refresh_token(user_id=user.id)
        
        # Try to store the refresh token, but continue even if it fails
        try:
            await user_service.store_refresh_token(db, user.id, refresh_token)
        except Exception as e:
            logger.warning(f"Could not store refresh token: {e}")
            # Continue anyway - we'll implement a migration strategy later
        
        logger.info(f"User logged in successfully: {user.username}")
        return {
            "access_token": access_token, 
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_at": datetime.utcnow() + access_token_expires
        }
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise

@router.post("/login/json", response_model=TokenSchema, summary="Login with JSON payload")
async def login_for_access_token_json(
    request: Request,
    user_credentials: UserLogin,
    db: Session = Depends(deps.get_db)
):
    """
    Alternative login endpoint that accepts a JSON payload.
    """
    # Apply rate limiting by client IP
    client_ip = request.client.host
    if not login_limiter.check(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )
    
    try:
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
        refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
        access_token = create_access_token(
            subject=user.id, expires_delta=access_token_expires
        )
        refresh_token = create_refresh_token(
            subject=user.id, expires_delta=refresh_token_expires
        )
        
        # Store refresh token in the database
        await user_service.store_refresh_token(db, user.id, refresh_token)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_at": datetime.utcnow() + access_token_expires
        }
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise

@router.post("/refresh", response_model=TokenSchema)
async def refresh_access_token(
    db: Session = Depends(deps.get_db),
    token: TokenPayload = Depends()
):
    """
    Get a new access token using a refresh token.
    """
    refresh_token = token.refresh_token
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refresh token is required"
        )
    
    user_id = verify_refresh_token(refresh_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify refresh token exists in database
    if not await user_service.validate_refresh_token(db, user_id, refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user_id, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post("/logout")
async def logout(
    db: Session = Depends(deps.get_db),
    current_user: UserSchema = Depends(deps.get_current_active_user),
    token: Optional[str] = Depends(deps.oauth2_scheme)
):
    """
    Logout a user by invalidating their refresh tokens.
    """
    await user_service.invalidate_all_refresh_tokens(db, current_user.id)
    logger.info(f"User logged out: {current_user.username}")
    return {"detail": "Successfully logged out"}

@router.get("/me", response_model=UserSchema)
async def read_users_me(
    current_user: UserSchema = Depends(deps.get_current_active_user)
):
    """
    Get current authenticated user.
    """
    return current_user

@router.post("/password-reset/request")
async def request_password_reset(
    email: str,
    db: Session = Depends(deps.get_db)
):
    """
    Request a password reset link via email.
    """
    user = await user_service.get_user_by_email(db, email)
    if user:
        # Generate password reset token and send email
        reset_token = await user_service.create_password_reset_token(db, user)
        # In a real application, send an email with the reset token
        # For now, we'll just return the token (not secure for production)
        logger.info(f"Password reset requested for: {email}")
        return {"detail": "Password reset email sent", "token": reset_token}
    else:
        # Still return success to prevent email enumeration attacks
        return {"detail": "Password reset email sent"}

@router.post("/password-reset/confirm")
async def reset_password(
    reset_data: PasswordReset,
    db: Session = Depends(deps.get_db)
):
    """
    Reset user password using the reset token.
    """
    if await user_service.reset_password(db, reset_data.token, reset_data.new_password):
        logger.info("Password reset successful")
        return {"detail": "Password reset successful"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token"
        )

@router.get("/verify-token")
async def verify_token(
    current_user: UserSchema = Depends(deps.get_current_active_user)
):
    """
    Verify if the current token is valid.
    """
    return {"detail": "Token is valid", "user_id": current_user.id}
