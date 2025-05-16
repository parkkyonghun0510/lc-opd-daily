from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api import deps
from app.api.auth_deps import require_permission, require_role, require_branch_access
from app.core.permissions import Permission, UserRole
from app.schemas import Branch, BranchCreate, BranchUpdate, User as UserSchema
from app.services import branch_service
from app.db.models import User

router = APIRouter()

@router.get("/", response_model=List[Branch])
async def read_branches(
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    search: Optional[str] = None,
    current_user: User = Depends(require_permission(Permission.VIEW_BRANCHES))
):
    """
    Retrieve branches.

    Requires VIEW_BRANCHES permission.
    """
    branches = await branch_service.get_branches(
        db=db, skip=skip, limit=limit, search=search
    )
    return branches

@router.get("/my-branches", response_model=List[Branch])
async def read_user_branches(
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Retrieve branches assigned to the current user.
    """
    branches = await branch_service.get_user_branches(
        db=db, user_id=current_user.id, skip=skip, limit=limit
    )
    return branches

@router.get("/{branch_id}", response_model=Branch)
async def read_branch(
    branch_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_BRANCHES))
):
    """
    Get a specific branch by id.

    Requires VIEW_BRANCHES permission.
    """
    branch = await branch_service.get_branch_by_id(db, branch_id=branch_id)
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
    return branch

@router.post("/", response_model=Branch, status_code=status.HTTP_201_CREATED)
async def create_branch(
    *,
    db: Session = Depends(deps.get_db),
    branch_in: BranchCreate,
    current_user: User = Depends(require_permission(Permission.MANAGE_BRANCHES))
):
    """
    Create new branch.

    Requires MANAGE_BRANCHES permission (typically admin users).
    """
    # Check if branch with same name already exists
    branch = await branch_service.get_branch_by_name(db, name=branch_in.name)
    if branch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Branch with this name already exists",
        )

    branch = await branch_service.create_branch(db=db, branch_in=branch_in)
    return branch

@router.put("/{branch_id}", response_model=Branch)
async def update_branch(
    *,
    db: Session = Depends(deps.get_db),
    branch_id: str,
    branch_in: BranchUpdate,
    current_user: User = Depends(require_permission(Permission.MANAGE_BRANCHES))
):
    """
    Update a branch.

    Requires MANAGE_BRANCHES permission (typically admin users).
    """
    branch = await branch_service.get_branch_by_id(db, branch_id=branch_id)
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    # If name is being changed, check for duplicates
    if branch_in.name and branch_in.name != branch.name:
        existing_branch = await branch_service.get_branch_by_name(db, name=branch_in.name)
        if existing_branch and existing_branch.id != branch_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Branch with this name already exists",
            )

    branch = await branch_service.update_branch(db=db, db_branch=branch, branch_in=branch_in)
    return branch

@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(
    *,
    db: Session = Depends(deps.get_db),
    branch_id: str,
    current_user: User = Depends(require_permission(Permission.MANAGE_BRANCHES))
):
    """
    Delete a branch.

    Requires MANAGE_BRANCHES permission (typically admin users).
    """
    branch = await branch_service.get_branch_by_id(db, branch_id=branch_id)
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    success = await branch_service.delete_branch(db=db, branch_id=branch_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete branch"
        )
    return None

@router.post("/{branch_id}/assign-user/{user_id}", status_code=status.HTTP_200_OK)
async def assign_user_to_branch(
    *,
    db: Session = Depends(deps.get_db),
    branch_id: str,
    user_id: str,
    current_user: User = Depends(require_permission(Permission.MANAGE_BRANCHES))
):
    """
    Assign a user to a branch.

    Requires MANAGE_BRANCHES permission (typically admin users).
    """
    # Check if branch exists
    branch = await branch_service.get_branch_by_id(db, branch_id=branch_id)
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await branch_service.assign_user_to_branch(
        db=db, user_id=user_id, branch_id=branch_id
    )

    return {"message": "User assigned to branch successfully"}

@router.delete("/{branch_id}/remove-user/{user_id}", status_code=status.HTTP_200_OK)
async def remove_user_from_branch(
    *,
    db: Session = Depends(deps.get_db),
    branch_id: str,
    user_id: str,
    current_user: User = Depends(require_permission(Permission.MANAGE_BRANCHES))
):
    """
    Remove a user from a branch.

    Requires MANAGE_BRANCHES permission (typically admin users).
    """
    success = await branch_service.remove_user_from_branch(
        db=db, user_id=user_id, branch_id=branch_id
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not assigned to this branch"
        )

    return {"message": "User removed from branch successfully"}
