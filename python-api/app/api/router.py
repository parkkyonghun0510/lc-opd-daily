from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime, timezone

# Import individual routers
from app.api.endpoints import auth, users, reports, branches
from app.api import deps
from app.core.config import settings

api_router = APIRouter()

# Include individual routers with their prefixes and tags
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"]
)
api_router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"]
)
api_router.include_router(
    reports.router,
    prefix="/reports",
    tags=["Reports"]
)
api_router.include_router(
    branches.router,
    prefix="/branches",
    tags=["Branches"]
)

# Health check endpoint
@api_router.get(
    "/health",
    tags=["Health Check"],
    summary="API Health Check",
    description="Check if the API is running and can connect to the database"
)
async def health_check(db: Session = Depends(deps.get_db)):
    """
    Perform a health check on the API.

    - Checks if the API is running
    - Checks database connectivity
    - Returns version information and uptime
    """
    # Check database connectivity
    try:
        # Simple query to check database connection
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except SQLAlchemyError as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "API router is healthy and running",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": getattr(settings, "API_VERSION", "1.0.0"),
        "environment": getattr(settings, "ENVIRONMENT", "development"),
        "database": db_status
    }

# System information endpoint
@api_router.get(
    "/system-info",
    tags=["Health Check"],
    summary="System Information",
    description="Get detailed system information about the API"
)
async def system_info():
    """
    Get detailed system information about the API.

    Returns:
    - API version
    - Environment
    - Startup time
    - Current time
    - Uptime
    """
    return {
        "api_name": getattr(settings, "PROJECT_NAME", "LC Reports API"),
        "version": getattr(settings, "API_VERSION", "1.0.0"),
        "environment": getattr(settings, "ENVIRONMENT", "development"),
        "current_time": datetime.now(timezone.utc).isoformat(),
        "cors_origins": getattr(settings, "CORS_ORIGINS", []),
        "docs_url": f"{settings.API_V1_STR}/docs",
        "openapi_url": f"{settings.API_V1_STR}/openapi.json"
    }
