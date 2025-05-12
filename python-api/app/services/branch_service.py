from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Union
from sqlalchemy import and_, or_, func

from app.db.models import Branch, UserBranchAssignment, User
from app.schemas import BranchCreate, BranchUpdate

async def get_branch_by_id(db: Session, branch_id: str) -> Optional[Branch]:
    """Get a branch by its ID."""
    return db.query(Branch).filter(Branch.id == branch_id).first()

async def get_branch_by_name(db: Session, name: str) -> Optional[Branch]:
    """Get a branch by its name."""
    return db.query(Branch).filter(Branch.name == name).first()

async def get_branches(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    search: Optional[str] = None
) -> List[Branch]:
    """Get all branches with optional search filter."""
    query = db.query(Branch)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Branch.name.ilike(search_term),
                Branch.code.ilike(search_term),
                Branch.address.ilike(search_term)
            )
        )
    
    return query.offset(skip).limit(limit).all()

async def get_user_branches(
    db: Session, 
    user_id: str,
    skip: int = 0, 
    limit: int = 100
) -> List[Branch]:
    """Get branches assigned to a specific user."""
    # Get branches directly assigned to the user
    user = db.query(User).filter(User.id == user_id).first()
    
    # If user has a direct branch assignment
    if user and user.branchId:
        branch = db.query(Branch).filter(Branch.id == user.branchId).first()
        if branch:
            return [branch]
    
    # Get branches from user branch assignments
    branch_ids = db.query(UserBranchAssignment.branchId).filter(
        UserBranchAssignment.userId == user_id
    ).all()
    
    branch_ids = [b[0] for b in branch_ids]  # Extract IDs from result tuples
    
    if not branch_ids:
        return []
    
    return db.query(Branch).filter(
        Branch.id.in_(branch_ids)
    ).offset(skip).limit(limit).all()

async def create_branch(db: Session, branch_in: BranchCreate) -> Branch:
    """Create a new branch."""
    db_branch = Branch(
        name=branch_in.name,
        code=branch_in.code,
        address=branch_in.address,
        phone=branch_in.phone,
        isActive=branch_in.isActive if branch_in.isActive is not None else True,
        # Add any other fields from your Branch model
    )
    
    db.add(db_branch)
    db.commit()
    db.refresh(db_branch)
    return db_branch

async def update_branch(
    db: Session, 
    db_branch: Branch, 
    branch_in: Union[BranchUpdate, Dict[str, Any]]
) -> Branch:
    """Update a branch."""
    if isinstance(branch_in, dict):
        update_data = branch_in
    else:
        update_data = branch_in.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_branch, field, value)
    
    db.add(db_branch)
    db.commit()
    db.refresh(db_branch)
    return db_branch

async def delete_branch(db: Session, branch_id: str) -> bool:
    """Delete a branch."""
    branch = await get_branch_by_id(db, branch_id)
    if not branch:
        return False
    
    db.delete(branch)
    db.commit()
    return True

async def assign_user_to_branch(
    db: Session, 
    user_id: str, 
    branch_id: str
) -> UserBranchAssignment:
    """Assign a user to a branch."""
    # Check if assignment already exists
    existing = db.query(UserBranchAssignment).filter(
        and_(
            UserBranchAssignment.userId == user_id,
            UserBranchAssignment.branchId == branch_id
        )
    ).first()
    
    if existing:
        return existing
    
    # Create new assignment
    assignment = UserBranchAssignment(
        userId=user_id,
        branchId=branch_id
    )
    
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment

async def remove_user_from_branch(
    db: Session, 
    user_id: str, 
    branch_id: str
) -> bool:
    """Remove a user from a branch."""
    assignment = db.query(UserBranchAssignment).filter(
        and_(
            UserBranchAssignment.userId == user_id,
            UserBranchAssignment.branchId == branch_id
        )
    ).first()
    
    if not assignment:
        return False
    
    db.delete(assignment)
    db.commit()
    return True
