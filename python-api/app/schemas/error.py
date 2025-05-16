from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class ErrorResponse(BaseModel):
    """
    Standard error response schema.
    """
    status: str = Field("error", description="Status of the response")
    message: str = Field(..., description="Error message")
    code: Optional[str] = Field(None, description="Error code for client handling")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    
class ValidationErrorResponse(ErrorResponse):
    """
    Error response for validation errors.
    """
    errors: List[Dict[str, Any]] = Field(..., description="List of validation errors")
