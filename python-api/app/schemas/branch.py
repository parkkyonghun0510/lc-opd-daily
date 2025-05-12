from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# Shared properties
class BranchBase(BaseModel):
    code: str = Field(..., example="B001", min_length=1, max_length=50)
    name: str = Field(..., example="Main Branch", min_length=1, max_length=100)
    isActive: Optional[bool] = True
    parentId: Optional[str] = Field(None, example="parent_branch_cuid_123")

# Properties to receive via API on creation
class BranchCreate(BranchBase):
    pass

# Properties to receive via API on update
class BranchUpdate(BranchBase):
    code: Optional[str] = Field(None, example="B001_updated", min_length=1, max_length=50)
    name: Optional[str] = Field(None, example="Main Branch Updated", min_length=1, max_length=100)
    isActive: Optional[bool] = None
    parentId: Optional[str] = Field(None, example="new_parent_branch_cuid_456")

# Properties shared by models stored in DB
class BranchInDBBase(BranchBase):
    id: str = Field(..., example="branch_cuid_xyz")
    createdAt: datetime
    updatedAt: Optional[datetime] = None

    model_config = {
        "from_attributes": True
    }

# Additional properties to return to client
class Branch(BranchInDBBase):
    # Potentially include children or parent info if needed for responses
    # children: List['Branch'] = [] # ForwardRef if Branch is defined later or handle circular imports
    # parent: Optional['Branch'] = None
    pass

# For nested representations if needed
class BranchSimple(BaseModel):
    id: str
    code: str
    name: str

    model_config = {
        "from_attributes": True
    }
