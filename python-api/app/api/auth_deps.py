from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List, Optional, Union, Callable

from app.api import deps
from app.core.permissions import Permission, UserRole, check_permission
from app.db.models import User
from app.services import user_service, branch_service

class PermissionDependency:
    """
    Dependency class for checking permissions.
    """
    def __init__(self, required_permission: Permission):
        self.required_permission = required_permission
        
    async def __call__(self, current_user: User = Depends(deps.get_current_active_user)):
        """
        Check if the current user has the required permission.
        
        Args:
            current_user: The current authenticated user
            
        Returns:
            The current user if they have the required permission
            
        Raises:
            HTTPException: If the user doesn't have the required permission
        """
        if not check_permission(current_user.role, self.required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {self.required_permission}"
            )
        return current_user

class RoleDependency:
    """
    Dependency class for checking user roles.
    """
    def __init__(self, required_role: Union[UserRole, List[UserRole]]):
        if isinstance(required_role, UserRole):
            self.required_roles = [required_role]
        else:
            self.required_roles = required_role
        
    async def __call__(self, current_user: User = Depends(deps.get_current_active_user)):
        """
        Check if the current user has one of the required roles.
        
        Args:
            current_user: The current authenticated user
            
        Returns:
            The current user if they have one of the required roles
            
        Raises:
            HTTPException: If the user doesn't have any of the required roles
        """
        user_role = UserRole(current_user.role)
        if user_role not in self.required_roles:
            role_names = [role.value for role in self.required_roles]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient role. Required: {', '.join(role_names)}"
            )
        return current_user

class BranchAccessDependency:
    """
    Dependency class for checking branch access.
    """
    def __init__(self, branch_id_param: str = "branch_id"):
        self.branch_id_param = branch_id_param
        
    async def __call__(
        self, 
        request: Request,
        db: Session = Depends(deps.get_db),
        current_user: User = Depends(deps.get_current_active_user)
    ):
        """
        Check if the current user has access to the specified branch.
        
        Args:
            request: The FastAPI request object
            db: Database session
            current_user: The current authenticated user
            
        Returns:
            The current user if they have access to the branch
            
        Raises:
            HTTPException: If the user doesn't have access to the branch
        """
        # Admin users have access to all branches
        if current_user.role == UserRole.ADMIN.value:
            return current_user
            
        # Get branch ID from path parameters
        branch_id = request.path_params.get(self.branch_id_param)
        if not branch_id:
            return current_user  # No branch ID specified
            
        # Check if user has access to the branch
        user_branches = await branch_service.get_user_branches(db, user_id=current_user.id)
        user_branch_ids = [branch.id for branch in user_branches]
        
        if branch_id not in user_branch_ids and current_user.branchId != branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this branch"
            )
            
        return current_user

# Convenience functions for common permission checks
def require_permission(permission: Permission):
    """
    Require a specific permission.
    
    Args:
        permission: The permission to require
        
    Returns:
        A dependency that checks for the required permission
    """
    return PermissionDependency(permission)

def require_role(role: Union[UserRole, List[UserRole]]):
    """
    Require a specific role or one of multiple roles.
    
    Args:
        role: The role(s) to require
        
    Returns:
        A dependency that checks for the required role(s)
    """
    return RoleDependency(role)

def require_branch_access(branch_id_param: str = "branch_id"):
    """
    Require access to a specific branch.
    
    Args:
        branch_id_param: The name of the path parameter containing the branch ID
        
    Returns:
        A dependency that checks for branch access
    """
    return BranchAccessDependency(branch_id_param)
