from fastapi import APIRouter
from app.api.endpoints import auth, users, branches  # Import your endpoint modules

api_router = APIRouter()

# Include your endpoint routers with their prefixes
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
# Add other routers as needed