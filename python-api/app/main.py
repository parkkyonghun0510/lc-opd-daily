from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router # Import the main API router
from app.core.config import settings # Import app settings

app = FastAPI(
    title=settings.PROJECT_NAME if hasattr(settings, 'PROJECT_NAME') else "LC Reports API", # Use project name from settings if available
    description=settings.PROJECT_DESCRIPTION if hasattr(settings, 'PROJECT_DESCRIPTION') else "API for LC Reports application", # Use project description from settings
    version=settings.API_VERSION if hasattr(settings, 'API_VERSION') else "1.0.0", # Use API version from settings
    openapi_url=f"{settings.API_V1_STR}/openapi.json" # Configure OpenAPI URL
)

# Set up CORS
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS], # Ensure origins are strings
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include the main API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/") # Root endpoint for basic health check or welcome message
async def root():
    return {"message": "LC Reports API is running"}

# To run this app (save as main.py in the app folder):
# uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
