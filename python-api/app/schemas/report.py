from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Any
from datetime import datetime, date as date_type

# Import these at the top to avoid forward reference issues
from .branch import BranchSimple
from .user import User

# Shared properties for a report
class ReportBase(BaseModel):
    branchId: str = Field(..., example="branch_cuid_123")
    writeOffs: float = Field(..., ge=0, example=100.50)
    ninetyPlus: float = Field(..., ge=0, example=2500.75)
    reportType: Literal["plan", "actual"] = Field(..., example="actual")
    date: date_type = Field(..., example="2023-10-26")

# Properties to receive via API on creation
class ReportCreate(ReportBase):
    # comments: Optional[str] = Field(None, example="Initial comments for the report.") # Legacy field
    initialComment: Optional[str] = Field(None, example="Initial comment to be stored in ReportComment model.")
    # submittedAt: str # This will be set by the server

# Properties to receive via API on update
class ReportUpdate(BaseModel):
    writeOffs: Optional[float] = Field(None, ge=0, example=150.00)
    ninetyPlus: Optional[float] = Field(None, ge=0, example=3000.00)
    # comments: Optional[str] = Field(None, example="Updated comments.") # Legacy field
    status: Optional[str] = Field(None, example="approved") # e.g., pending, approved, rejected

# Properties shared by models stored in DB
class ReportInDBBase(ReportBase):
    id: str = Field(..., example="report_cuid_xyz")
    status: str = Field(..., example="pending")
    submittedBy: str = Field(..., example="user_cuid_abc")
    submittedAt: str # Stored as string, consider datetime if changing
    createdAt: datetime
    updatedAt: Optional[datetime] = None
    planReportId: Optional[str] = Field(None, example="plan_report_cuid_789")
    comments: Optional[str] = None # Legacy comments field

    model_config = {
        "from_attributes": True
    }

# Additional properties to return to client
class Report(ReportInDBBase):
    branch: Optional[BranchSimple] = None # Use direct type reference
    submitter: Optional[User] = None # Use direct type reference

    # For actual reports, include plan data if available
    writeOffsPlan: Optional[float] = Field(None, example=90.0)
    ninetyPlusPlan: Optional[float] = Field(None, example=2400.0)

    # If ReportComment schema is defined and you want to nest comments:
    # reportComments: List["ReportComment"] = []


# Schema for paginated list of reports
class ReportPage(BaseModel):
    data: List[Report]
    total: int
    page: int
    limit: int
    totalPages: int

# Schema for creating a comment on a report (if handled separately)
class ReportCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, example="This is a comment on the report.")
    # reportId and userId will be taken from path/token
