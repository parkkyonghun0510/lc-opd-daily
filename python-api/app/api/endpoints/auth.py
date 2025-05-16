from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel

from app.api import deps
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, verify_refresh_token
from app.schemas import (
    User as UserSchema,
    Token as TokenSchema,
    UserLogin,
    TokenPayload,
    PasswordReset,
    ErrorResponse
)
from app.services import user_service
from app.utils.rate_limit import RateLimiter

# Set up logging - fallback to standard logging if structured logging is not available
try:
    from app.utils.logging import setup_structured_logger
    logger = setup_structured_logger(__name__)
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

# Initialize rate limiter with increased capacity (10 attempts per minute)
login_limiter = RateLimiter(max_calls=10, time_frame=60)

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
async def _authenticate_and_create_tokens(
    request: Request,
    db: Session,
    username: str,
    password: str
) -> dict:
    """
    Common authentication function used by both login endpoints.
    Authenticates user, creates tokens, and returns token data.

    Args:
        request: The FastAPI request object
        db: Database session
        username: Username or email
        password: User password

    Returns:
        Dictionary with token data

    Raises:
        HTTPException: If authentication fails or rate limit is exceeded
    """
    # Apply rate limiting by client IP
    client_ip = request.client.host if request.client else "unknown"
    if not login_limiter.check(client_ip):
        logger.warning({"event": "rate_limit_exceeded", "ip": client_ip})
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )

    try:
        # Authenticate user
        user = await user_service.authenticate_user(
            db, username_or_email=username, password=password
        )

        # Check if user exists and is active
        if not user:
            logger.warning({"event": "failed_login", "username": username})
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif not user_service.is_active(user):
            logger.warning({"event": "inactive_user_login", "username": username})
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )

        # Create tokens with consistent expiration times
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        # Prepare token data with user information
        token_data = {
            "role": user.role,
            "name": user.name,
            "branchId": user.branchId
        }

        # Use core security functions for token creation with enhanced data
        access_token = create_access_token(
            subject=user.id,
            expires_delta=access_token_expires,
            extra_data=token_data
        )
        refresh_token = create_refresh_token(
            subject=user.id,
            expires_delta=refresh_token_expires,
            extra_data=token_data
        )

        # Store refresh token in database
        try:
            await user_service.store_refresh_token(db, user.id, refresh_token)
        except Exception as e:
            logger.warning({"event": "refresh_token_storage_failed", "error": str(e)})
            # Continue anyway - we'll implement a migration strategy later

        # Log successful login
        logger.info({"event": "login_success", "user_id": user.id, "username": user.username})

        # Return token data
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_at": datetime.now(timezone.utc) + access_token_expires
        }
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log unexpected errors
        logger.error({"event": "login_error", "error": str(e)}, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during login"
        )

@router.post("/login", response_model=TokenSchema, summary="Login with username and password")
async def login_for_access_token(
    request: Request,
    db: Session = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends() # Using form data for login
):
    """
    OAuth2 compatible token login, get an access token for future requests.
    Takes username and password from form data.

    Returns:
        TokenSchema: Access token, refresh token, token type and expiration
    """
    return await _authenticate_and_create_tokens(
        request=request,
        db=db,
        username=form_data.username,
        password=form_data.password
    )

@router.post("/login/json", response_model=TokenSchema, summary="Login with JSON payload")
async def login_for_access_token_json(
    request: Request,
    user_credentials: UserLogin,
    db: Session = Depends(deps.get_db)
):
    """
    Alternative login endpoint that accepts a JSON payload.

    Returns:
        TokenSchema: Access token, refresh token, token type and expiration
    """
    return await _authenticate_and_create_tokens(
        request=request,
        db=db,
        username=user_credentials.username,
        password=user_credentials.password
    )

@router.post("/refresh", response_model=TokenSchema, summary="Refresh access token")
async def refresh_access_token(
    db: Session = Depends(deps.get_db),
    token: TokenPayload = Depends()
):
    """
    Get a new access token using a refresh token.

    This endpoint allows clients to obtain a new access token without requiring
    the user to re-authenticate with their username and password.

    Returns:
        TokenSchema: New access token with the same refresh token
    """
    try:
        # Validate refresh token is provided
        refresh_token = token.refresh_token
        if not refresh_token:
            logger.warning({"event": "refresh_token_missing"})
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refresh token is required"
            )

        # Verify token signature and expiration
        user_id = verify_refresh_token(refresh_token)
        if not user_id:
            logger.warning({"event": "invalid_refresh_token"})
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify token exists in database and is not revoked
        if not await user_service.validate_refresh_token(db, user_id, refresh_token):
            logger.warning({"event": "revoked_refresh_token", "user_id": user_id})
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Get user data to include in the new token
        user = await user_service.get_user_by_id(db, user_id)
        if not user:
            logger.warning({"event": "refresh_token_user_not_found", "user_id": user_id})
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Prepare token data with user information
        token_data = {
            "role": user.role,
            "name": user.name,
            "branchId": user.branchId
        }

        # Create new access token with user data
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            subject=user_id,
            expires_delta=access_token_expires,
            extra_data=token_data
        )

        # Get expiration time for response
        expires_at = datetime.now(timezone.utc) + access_token_expires

        logger.info({"event": "token_refreshed", "user_id": user_id})

        # Return new access token with same refresh token
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_at": expires_at
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error({"event": "refresh_token_error", "error": str(e)}, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while refreshing token"
        )

class LogoutResponse(BaseModel):
    """Response model for logout endpoint"""
    detail: str
    status: str = "success"

@router.post("/logout", response_model=LogoutResponse)
async def logout(
    db: Session = Depends(deps.get_db),
    current_user: UserSchema = Depends(deps.get_current_active_user)
):
    """
    Logout a user by invalidating all their refresh tokens.

    This endpoint requires authentication with a valid access token.
    After logout, all refresh tokens for the user will be invalidated,
    requiring the user to log in again to get new tokens.

    Returns:
        LogoutResponse: Success message
    """
    try:
        # Invalidate all refresh tokens for the user
        await user_service.invalidate_all_refresh_tokens(db, current_user.id)

        # Log the logout event
        logger.info({
            "event": "user_logout",
            "user_id": current_user.id,
            "username": current_user.username
        })

        return {"detail": "Successfully logged out", "status": "success"}
    except Exception as e:
        logger.error({"event": "logout_error", "error": str(e)}, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during logout"
        )

class UserMetadataResponse(BaseModel):
    """Response model for user metadata"""
    ip_address: str
    user_agent: str
    last_accessed: str
    token_preview: str

class UserResponse(BaseModel):
    """Response model for user data"""
    id: str
    username: str
    email: str
    name: Optional[str] = None
    role: str
    isActive: bool
    branchId: Optional[str] = None
    image: Optional[str] = None
    lastLogin: Optional[datetime] = None
    client_metadata: Optional[UserMetadataResponse] = None

    model_config = {
        "from_attributes": True
    }

@router.get("/me",
            response_model=UserResponse,
            summary="Get current user information")
async def read_users_me(
    request: Request,
    include_metadata: bool = False,
    current_user: UserSchema = Depends(deps.get_current_active_user),
    db: Session = Depends(deps.get_db)
):
    """
    Get current authenticated user.

    This endpoint requires a valid JWT token in the Authorization header.

    Parameters:
    - include_metadata: If true, includes client metadata like IP and user agent

    Returns:
        UserResponse: Current user data with optional metadata
    """
    try:
        # Get the token from the request for metadata
        token = None
        if include_metadata:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        # Convert user model to dict
        response_data = {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "name": current_user.name,
            "role": current_user.role,
            "isActive": current_user.isActive,
            "branchId": current_user.branchId,
            "image": current_user.image,
            "lastLogin": current_user.lastLogin
        }

        # Add client metadata if requested
        if include_metadata:
            client_ip = request.client.host if request.client else "unknown"
            response_data["client_metadata"] = {
                "ip_address": client_ip,
                "user_agent": request.headers.get("user-agent", "Unknown"),
                "last_accessed": datetime.now(timezone.utc).isoformat(),
                "token_preview": token[:10] + "..." if token and len(token) > 10 else "N/A"
            }

            # Update last activity
            try:
                await user_service.update_last_activity(db, current_user.id)
            except Exception as e:
                logger.warning({"event": "update_activity_failed", "error": str(e)})

        logger.info({"event": "user_info_accessed", "user_id": current_user.id})
        return response_data

    except Exception as e:
        logger.error({"event": "me_endpoint_error", "error": str(e)}, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving user information"
        )

class TokenDebugResponse(BaseModel):
    """Response model for token debug endpoint"""
    status: str
    message: str
    token_valid: Optional[bool] = None
    user_id: Optional[str] = None
    username: Optional[str] = None
    is_active: Optional[bool] = None
    token_preview: Optional[str] = None
    received: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None

@router.get("/debug-token",
            response_model=TokenDebugResponse,
            summary="Debug token validity")
async def debug_token(
    request: Request,
    db: Session = Depends(deps.get_db),
):
    """
    Debug endpoint to check if the token is being properly passed and parsed.

    This endpoint is useful for debugging authentication issues. It attempts to
    parse and validate the token from the Authorization header and returns
    detailed information about the token and associated user.

    Returns:
        TokenDebugResponse: Token validation results
    """
    auth_header = request.headers.get("Authorization", "")

    if not auth_header:
        logger.info({"event": "debug_token", "issue": "missing_header"})
        return {
            "status": "error",
            "message": "No Authorization header found"
        }

    parts = auth_header.split()

    if len(parts) != 2 or parts[0].lower() != "bearer":
        logger.info({
            "event": "debug_token",
            "issue": "invalid_format",
            "header": auth_header
        })
        return {
            "status": "error",
            "message": "Invalid Authorization header format. Use 'Bearer YOUR_TOKEN'",
            "received": auth_header
        }

    token = parts[1]
    token_preview = token[:10] + "..." if len(token) > 10 else token

    try:
        # Try to decode and validate the token
        from app.core.security import decode_access_token
        payload = decode_access_token(token)

        if not payload:
            logger.info({
                "event": "debug_token",
                "issue": "invalid_token",
                "token_preview": token_preview
            })
            return {
                "status": "error",
                "message": "Invalid token format or signature",
                "token_preview": token_preview
            }

        user_id = payload.get("sub")

        if not user_id:
            logger.info({
                "event": "debug_token",
                "issue": "missing_sub_claim",
                "payload": payload
            })
            return {
                "status": "error",
                "message": "Token missing 'sub' claim",
                "payload": payload,
                "token_preview": token_preview
            }

        user = await user_service.get_user_by_id(db, user_id)

        if not user:
            logger.info({
                "event": "debug_token",
                "issue": "user_not_found",
                "user_id": user_id
            })
            return {
                "status": "error",
                "message": f"User ID {user_id} not found in database",
                "user_id": user_id,
                "token_preview": token_preview
            }

        is_active = user_service.is_active(user)

        logger.info({
            "event": "debug_token",
            "result": "success",
            "user_id": user_id
        })

        return {
            "status": "success",
            "message": "Token is valid",
            "token_valid": True,
            "user_id": user_id,
            "username": user.username,
            "is_active": is_active,
            "token_preview": token_preview
        }

    except Exception as e:
        logger.warning({
            "event": "debug_token",
            "issue": "validation_error",
            "error": str(e)
        })
        return {
            "status": "error",
            "message": f"Token validation failed: {str(e)}",
            "token_preview": token_preview
        }

class PasswordResetRequestResponse(BaseModel):
    """Response model for password reset request"""
    detail: str
    token: Optional[str] = None  # Only included in development

class PasswordResetConfirmResponse(BaseModel):
    """Response model for password reset confirmation"""
    detail: str
    status: str = "success"

class TokenVerifyResponse(BaseModel):
    """Response model for token verification"""
    detail: str
    user_id: str
    status: str = "success"

@router.post("/password-reset/request", response_model=PasswordResetRequestResponse)
async def request_password_reset(
    email: str,
    db: Session = Depends(deps.get_db)
):
    """
    Request a password reset link via email.

    This endpoint initiates the password reset process by generating a reset token
    and (in a production environment) sending it to the user's email.

    For security reasons, this endpoint always returns a success response
    regardless of whether the email exists in the system.

    Returns:
        PasswordResetRequestResponse: Success message and token (in development)
    """
    try:
        user = await user_service.get_user_by_email(db, email)
        if user:
            # Generate password reset token
            reset_token = await user_service.create_password_reset_token(db, user)

            # In a real application, send an email with the reset token
            # For now, we'll just return the token (not secure for production)
            logger.info({"event": "password_reset_requested", "email": email})

            # In development, return the token for testing
            if settings.ENVIRONMENT == "development":
                return {"detail": "Password reset email sent", "token": reset_token}
        else:
            # Log attempt on non-existent email
            logger.info({"event": "password_reset_nonexistent", "email": email})

        # Always return success to prevent email enumeration attacks
        return {"detail": "Password reset email sent"}
    except Exception as e:
        logger.error({"event": "password_reset_error", "error": str(e)}, exc_info=True)
        # Still return success to prevent email enumeration
        return {"detail": "Password reset email sent"}

@router.post("/password-reset/confirm", response_model=PasswordResetConfirmResponse)
async def reset_password(
    reset_data: PasswordReset,
    db: Session = Depends(deps.get_db)
):
    """
    Reset user password using the reset token.

    This endpoint completes the password reset process by verifying the token
    and setting the new password.

    Returns:
        PasswordResetConfirmResponse: Success message
    """
    try:
        if await user_service.reset_password(db, reset_data.token, reset_data.new_password):
            logger.info({"event": "password_reset_success"})
            return {"detail": "Password reset successful", "status": "success"}
        else:
            logger.warning({"event": "password_reset_invalid_token"})
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired token"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error({"event": "password_reset_error", "error": str(e)}, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during password reset"
        )

@router.get("/verify-token", response_model=TokenVerifyResponse)
async def verify_token(
    current_user: UserSchema = Depends(deps.get_current_active_user)
):
    """
    Verify if the current token is valid.

    This endpoint is a simple way to check if the user's token is still valid
    without retrieving any additional data.

    Returns:
        TokenVerifyResponse: Success message with user ID
    """
    logger.info({"event": "token_verified", "user_id": current_user.id})
    return {
        "detail": "Token is valid",
        "user_id": current_user.id,
        "status": "success"
    }

# Initialize authentication components at module level
try:
    # Check bcrypt version and availability
    import bcrypt
    bcrypt_version = getattr(bcrypt, "__version__", "unknown")
    logger.info({"event": "auth_module_init", "bcrypt_version": bcrypt_version})

    # Log token expiration settings
    logger.info({
        "event": "auth_token_settings",
        "access_token_expire_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        "refresh_token_expire_days": settings.REFRESH_TOKEN_EXPIRE_DAYS
    })
except Exception as e:
    logger.warning({"event": "auth_module_warning", "error": str(e)})
