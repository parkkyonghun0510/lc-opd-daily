from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from app.api.router import api_router # Import the main API router
from app.core.config import settings # Import app settings

app = FastAPI(
    title=settings.PROJECT_NAME if hasattr(settings, 'PROJECT_NAME') else "LC Reports API", # Use project name from settings if available
    description=settings.PROJECT_DESCRIPTION if hasattr(settings, 'PROJECT_DESCRIPTION') else "API for LC Reports application", # Use project description from settings
    version=settings.API_VERSION if hasattr(settings, 'API_VERSION') else "1.0.0", # Use API version from settings
    openapi_url="/openapi.json" # Configure OpenAPI URL (without API prefix)
)

# Custom OpenAPI schema with security definitions
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    # Make sure components exists
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}

    # Preserve existing schemas if any
    if "schemas" not in openapi_schema["components"]:
        openapi_schema["components"]["schemas"] = {}

    # Add JWT bearer security scheme
    openapi_schema["components"]["securitySchemes"] = {
        "Bearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter 'Bearer' [space] and then your token in the text input below.\nExample: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'"
        }
    }

    # Apply security globally to all operations
    openapi_schema["security"] = [{"Bearer": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

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
