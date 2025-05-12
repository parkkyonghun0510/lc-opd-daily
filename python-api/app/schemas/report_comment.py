from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# Import schemas for related models if they will be nested
from .user import User # Simplified User schema for comment author

# Shared properties for a report comment
class ReportCommentBase(BaseModel):
    content: str = Field(..., min_length=1, example="This is a detailed comment on the report.")
    parentId: Optional[str] = Field(None, example="parent_comment_cuid_456") # For threaded comments

# Properties to receive via API on creation
# reportId and userId will typically be derived from the path and authenticated user respectively
class ReportCommentCreate(ReportCommentBase):
    pass

# Properties to receive via API on update
class ReportCommentUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1, example="Updated comment content.")

# Properties shared by models stored in DB
class ReportCommentInDBBase(ReportCommentBase):
    id: str = Field(..., example="comment_cuid_xyz")
    reportId: str = Field(..., example="report_cuid_abc")
    userId: str = Field(..., example="user_cuid_123")
    createdAt: datetime
    updatedAt: Optional[datetime] = None

    model_config = {
        "from_attributes": True
    }

# Additional properties to return to client
class ReportComment(ReportCommentInDBBase):
    user: Optional[User] = None # Nested author information
    replies: List['ReportComment'] = [] # For nested replies, requires forward reference handling

# Self-referencing for replies
ReportComment.update_forward_refs()
