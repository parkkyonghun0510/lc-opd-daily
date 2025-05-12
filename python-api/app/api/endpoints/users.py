from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Any

from app.api import deps # Dependency functions
from app.schemas import User as UserSchema, UserCreate, UserUpdate # Pydantic schemas
from app.services import user_service # User service functions
from app.db.models import User as UserModel # SQLAlchemy model

router = APIRouter()

@router.post("/", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def create_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
    # current_user: UserModel = Depends(deps.get_current_active_superuser) # Uncomment to restrict to superusers
):
    """
    Create new user.
    (Currently open, uncomment dependency to restrict to superusers).
    """
    user = await user_service.get_user_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system.",
        )
    user_by_username = await user_service.get_user_by_username(db, username=user_in.username)
    if user_by_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this username already exists in the system.",
        )
    
    # In a real app, consider adding ID generation here if not handled by DB
    # e.g., from cuid import cuid; user_in.id = cuid() if needed by model/service
    
    new_user = await user_service.create_user(db=db, user_in=user_in)
    return new_user

@router.get("/", response_model=List[UserSchema])
async def read_users(
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    # current_user: UserModel = Depends(deps.get_current_active_superuser) # Uncomment to restrict
):
    """
    Retrieve users.
    (Currently open, uncomment dependency to restrict to superusers).
    """
    # This needs a corresponding service function, e.g., user_service.get_multi()
    # Placeholder implementation:
    users = db.query(UserModel).offset(skip).limit(limit).all()
    return users

@router.get("/{user_id}", response_model=UserSchema)
async def read_user_by_id(
    user_id: str,
    db: Session = Depends(deps.get_db),
    current_user: UserModel = Depends(deps.get_current_active_user) # Any active user can view profiles? Adjust as needed.
):
    """
    Get a specific user by id.
    """
    user = await user_service.get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Optional: Add permission check if users can only view their own profile or if admins can view any
    # if user.id != current_user.id and not user_service.is_superuser(current_user):
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
        
    return user

@router.put("/{user_id}", response_model=UserSchema)
async def update_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: str,
    user_in: UserUpdate,
    current_user: UserModel = Depends(deps.get_current_active_user)
):
    """
    Update a user. Users can update their own profile. Admins can update any.
    """
    user = await user_service.get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    # Check permissions: User can update self, or superuser can update anyone
    if user.id != current_user.id and not user_service.is_superuser(current_user):
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    # Check for email/username conflicts if they are being changed
    if user_in.email and user_in.email != user.email:
        existing_user = await user_service.get_user_by_email(db, email=user_in.email)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
            
    if user_in.username and user_in.username != user.username:
        existing_user = await user_service.get_user_by_username(db, username=user_in.username)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    updated_user = await user_service.update_user(db=db, db_user=user, user_in=user_in)
    return updated_user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: str,
    current_user: UserModel = Depends(deps.get_current_active_superuser) # Only superusers can delete
):
    """
    Delete a user. (Requires superuser privileges).
    """
    user = await user_service.get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    # Optional: Prevent deleting oneself?
    # if user.id == current_user.id:
    #     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete own account")

    # This needs a corresponding service function, e.g., user_service.remove()
    # Placeholder implementation:
    db.delete(user)
    db.commit()
    return None # Return None for 204 status code
