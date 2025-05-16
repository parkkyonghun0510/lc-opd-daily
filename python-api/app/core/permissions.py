from enum import Enum, auto
from typing import Dict, List, Optional, Set, Union

class Permission(str, Enum):
    """
    Enum defining all possible permissions in the system.
    This should match the frontend Permission enum.
    """
    # User management
    MANAGE_USERS = "manage_users"
    VIEW_USERS = "view_users"
    
    # Branch management
    MANAGE_BRANCHES = "manage_branches"
    VIEW_BRANCHES = "view_branches"
    
    # Report permissions
    CREATE_REPORTS = "create_reports"
    EDIT_REPORTS = "edit_reports"
    DELETE_REPORTS = "delete_reports"
    VIEW_REPORTS = "view_reports"
    APPROVE_REPORTS = "approve_reports"
    EDIT_OWN_REPORTS = "edit_own_reports"
    DELETE_OWN_REPORTS = "delete_own_reports"
    
    # Comment permissions
    ADD_COMMENTS = "add_comments"
    EDIT_COMMENTS = "edit_comments"
    DELETE_COMMENTS = "delete_comments"
    EDIT_OWN_COMMENTS = "edit_own_comments"
    DELETE_OWN_COMMENTS = "delete_own_comments"

class UserRole(str, Enum):
    """
    Enum defining all possible user roles in the system.
    This should match the frontend UserRole enum.
    """
    ADMIN = "admin"
    BRANCH_MANAGER = "manager"
    USER = "user"
    READONLY = "readonly"

# Define permissions for each role
ROLE_PERMISSIONS: Dict[UserRole, Set[Permission]] = {
    UserRole.ADMIN: {
        # Admin has all permissions
        Permission.MANAGE_USERS,
        Permission.VIEW_USERS,
        Permission.MANAGE_BRANCHES,
        Permission.VIEW_BRANCHES,
        Permission.CREATE_REPORTS,
        Permission.EDIT_REPORTS,
        Permission.DELETE_REPORTS,
        Permission.VIEW_REPORTS,
        Permission.APPROVE_REPORTS,
        Permission.EDIT_OWN_REPORTS,
        Permission.DELETE_OWN_REPORTS,
        Permission.ADD_COMMENTS,
        Permission.EDIT_COMMENTS,
        Permission.DELETE_COMMENTS,
        Permission.EDIT_OWN_COMMENTS,
        Permission.DELETE_OWN_COMMENTS,
    },
    UserRole.BRANCH_MANAGER: {
        # Branch manager permissions
        Permission.VIEW_USERS,
        Permission.VIEW_BRANCHES,
        Permission.CREATE_REPORTS,
        Permission.EDIT_REPORTS,
        Permission.VIEW_REPORTS,
        Permission.APPROVE_REPORTS,
        Permission.EDIT_OWN_REPORTS,
        Permission.DELETE_OWN_REPORTS,
        Permission.ADD_COMMENTS,
        Permission.EDIT_COMMENTS,
        Permission.DELETE_COMMENTS,
        Permission.EDIT_OWN_COMMENTS,
        Permission.DELETE_OWN_COMMENTS,
    },
    UserRole.USER: {
        # Regular user permissions
        Permission.VIEW_BRANCHES,
        Permission.CREATE_REPORTS,
        Permission.VIEW_REPORTS,
        Permission.EDIT_OWN_REPORTS,
        Permission.DELETE_OWN_REPORTS,
        Permission.ADD_COMMENTS,
        Permission.EDIT_OWN_COMMENTS,
        Permission.DELETE_OWN_COMMENTS,
    },
    UserRole.READONLY: {
        # Read-only user permissions
        Permission.VIEW_BRANCHES,
        Permission.VIEW_REPORTS,
        Permission.ADD_COMMENTS,
        Permission.EDIT_OWN_COMMENTS,
        Permission.DELETE_OWN_COMMENTS,
    }
}

def check_permission(role: Union[str, UserRole], permission: Union[str, Permission]) -> bool:
    """
    Check if a role has a specific permission.
    
    Args:
        role: The user role to check
        permission: The permission to check for
        
    Returns:
        True if the role has the permission, False otherwise
    """
    # Convert string role to UserRole enum if needed
    if isinstance(role, str):
        try:
            role = UserRole(role)
        except ValueError:
            return False  # Invalid role
    
    # Convert string permission to Permission enum if needed
    if isinstance(permission, str):
        try:
            permission = Permission(permission)
        except ValueError:
            return False  # Invalid permission
    
    # Check if the role has the permission
    return permission in ROLE_PERMISSIONS.get(role, set())

def get_role_permissions(role: Union[str, UserRole]) -> Set[Permission]:
    """
    Get all permissions for a specific role.
    
    Args:
        role: The user role to get permissions for
        
    Returns:
        Set of permissions for the role
    """
    # Convert string role to UserRole enum if needed
    if isinstance(role, str):
        try:
            role = UserRole(role)
        except ValueError:
            return set()  # Invalid role
    
    return ROLE_PERMISSIONS.get(role, set())
