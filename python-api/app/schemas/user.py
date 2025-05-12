from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# Shared properties
class UserBase(BaseModel):
    email: EmailStr = Field(..., example="user@example.com")
    username: str = Field(..., min_length=3, max_length=50, example="john_doe")
    name: Optional[str] = Field(None, example="John Doe")
    isActive: Optional[bool] = True
    role: Optional[str] = Field("user", example="user") # Default role
    branchId: Optional[str] = Field(None, example="branch_cuid_123")
    image: Optional[str] = Field(None, example="https://example.com/avatar.png")

# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(..., min_length=8, example="a_secure_password")

# Properties to receive via API on update
class UserUpdate(UserBase):
    email: Optional[EmailStr] = Field(None, example="user_new@example.com")
    username: Optional[str] = Field(None, min_length=3, max_length=50, example="john_doe_new")
    password: Optional[str] = Field(None, min_length=8, example="a_new_secure_password")
    name: Optional[str] = Field(None, example="Johnathan Doe")
    isActive: Optional[bool] = None
    role: Optional[str] = Field(None, example="admin")
    branchId: Optional[str] = Field(None, example="branch_cuid_456")
    image: Optional[str] = Field(None, example="https://example.com/new_avatar.png")
    preferences: Optional[dict] = Field(None, example={"theme": "dark"})


# Properties shared by models stored in DB
class UserInDBBase(UserBase):
    id: str = Field(..., example="user_cuid_xyz")
    createdAt: datetime
    updatedAt: Optional[datetime] = None
    lastLogin: Optional[datetime] = None
    failedLoginAttempts: Optional[int] = 0
    lockedUntil: Optional[datetime] = None
    preferences: Optional[dict] = Field(None, example={"theme": "dark"})

    model_config = {
        "from_attributes": True
    }

# Additional properties to return to client
class User(UserInDBBase):
    pass

# Additional properties stored in DB
class UserInDB(UserInDBBase):
    hashed_password: str # Store hashed password in DB, not plain password

# For token response
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None # Subject (user ID or username)

class UserLogin(BaseModel):
    username: str = Field(..., example="john_doe") # Can be username or email
    password: str = Field(..., example="a_secure_password")

# Schema for changing password
class UserPasswordChange(BaseModel):
    current_password: str = Field(..., example="current_secure_password")
    new_password: str = Field(..., min_length=8, example="new_very_secure_password")
