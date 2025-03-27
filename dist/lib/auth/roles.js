export var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["BRANCH_MANAGER"] = "BRANCH_MANAGER";
    UserRole["SUPERVISOR"] = "SUPERVISOR";
    UserRole["USER"] = "USER";
})(UserRole || (UserRole = {}));
export var Permission;
(function (Permission) {
    // Admin Access
    Permission["ACCESS_ADMIN"] = "ACCESS_ADMIN";
    Permission["ASSIGN_ROLES"] = "ASSIGN_ROLES";
    Permission["MANAGE_USERS"] = "MANAGE_USERS";
    Permission["MANAGE_BRANCHES"] = "MANAGE_BRANCHES";
    Permission["MANAGE_SETTINGS"] = "MANAGE_SETTINGS";
    // Report Permissions
    Permission["VIEW_REPORTS"] = "VIEW_REPORTS";
    Permission["CREATE_REPORTS"] = "CREATE_REPORTS";
    Permission["EDIT_REPORTS"] = "EDIT_REPORTS";
    Permission["DELETE_REPORTS"] = "DELETE_REPORTS";
    Permission["REVIEW_REPORTS"] = "REVIEW_REPORTS";
    Permission["CONSOLIDATE_REPORTS"] = "CONSOLIDATE_REPORTS";
    Permission["RESTORE_REPORTS"] = "RESTORE_REPORTS";
    Permission["EXPORT_REPORTS"] = "EXPORT_REPORTS";
    Permission["APPROVE_REPORTS"] = "APPROVE_REPORTS";
    Permission["ARCHIVE_REPORTS"] = "ARCHIVE_REPORTS";
    // Branch Permissions
    Permission["VIEW_BRANCH"] = "VIEW_BRANCH";
    Permission["MANAGE_BRANCH"] = "MANAGE_BRANCH";
    Permission["CREATE_BRANCH"] = "CREATE_BRANCH";
    Permission["EDIT_BRANCH"] = "EDIT_BRANCH";
    Permission["DELETE_BRANCH"] = "DELETE_BRANCH";
    Permission["ASSIGN_BRANCH_MANAGER"] = "ASSIGN_BRANCH_MANAGER";
    Permission["VIEW_BRANCH_ANALYTICS"] = "VIEW_BRANCH_ANALYTICS";
    // User Permissions
    Permission["VIEW_USERS"] = "VIEW_USERS";
    Permission["CREATE_USER"] = "CREATE_USER";
    Permission["EDIT_USER"] = "EDIT_USER";
    Permission["DELETE_USER"] = "DELETE_USER";
    Permission["RESET_USER_PASSWORD"] = "RESET_USER_PASSWORD";
    // Dashboard Permissions
    Permission["VIEW_DASHBOARD"] = "view_dashboard";
    Permission["VIEW_ANALYTICS"] = "view_analytics";
    Permission["EXPORT_ANALYTICS"] = "export_analytics";
    Permission["CUSTOMIZE_DASHBOARD"] = "customize_dashboard";
    // Audit Permissions
    Permission["VIEW_AUDIT_LOGS"] = "view_audit_logs";
    Permission["EXPORT_AUDIT_LOGS"] = "export_audit_logs";
})(Permission || (Permission = {}));
// Define role-based permissions
export const ROLE_PERMISSIONS = {
    [UserRole.ADMIN]: Object.values(Permission),
    [UserRole.BRANCH_MANAGER]: [
        Permission.VIEW_REPORTS,
        Permission.CREATE_REPORTS,
        Permission.EDIT_REPORTS,
        Permission.DELETE_REPORTS,
        Permission.APPROVE_REPORTS,
        Permission.VIEW_BRANCH,
        Permission.MANAGE_BRANCH,
        Permission.VIEW_USERS,
        Permission.VIEW_BRANCH_ANALYTICS,
    ],
    [UserRole.SUPERVISOR]: [
        Permission.VIEW_REPORTS,
        Permission.CREATE_REPORTS,
        Permission.EDIT_REPORTS,
        Permission.VIEW_BRANCH,
        Permission.VIEW_USERS,
    ],
    [UserRole.USER]: [
        Permission.VIEW_REPORTS,
        Permission.CREATE_REPORTS,
        Permission.VIEW_BRANCH,
    ],
};
// Helper functions
export function hasPermission(userRole, permission) {
    return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
}
export function hasAnyPermission(userRole, permissions) {
    return permissions.some((permission) => hasPermission(userRole, permission));
}
export function hasAllPermissions(userRole, permissions) {
    return permissions.every((permission) => hasPermission(userRole, permission));
}
// Get all permissions for a role
export function getRolePermissions(role) {
    return ROLE_PERMISSIONS[role] || [];
}
// Enhanced branch access control with hierarchy and multi-branch assignment support
export function canAccessBranch(userRole, userBranchId, targetBranchId, branchHierarchy, assignedBranchIds) {
    if (userRole === UserRole.ADMIN)
        return true;
    if (!userBranchId && !assignedBranchIds?.length)
        return false;
    // Check if user has direct assignment to target branch
    if (assignedBranchIds?.includes(targetBranchId))
        return true;
    // If no hierarchy provided, fall back to direct branch check
    if (!branchHierarchy) {
        return (userBranchId === targetBranchId ||
            assignedBranchIds?.includes(targetBranchId) ||
            false);
    }
    const userBranch = branchHierarchy.find((b) => b.id === userBranchId);
    const targetBranch = branchHierarchy.find((b) => b.id === targetBranchId);
    if (!userBranch || !targetBranch)
        return false;
    switch (userRole) {
        case UserRole.BRANCH_MANAGER:
            // Branch manager can access their default branch, assigned branches, and any child branches
            return ((userBranchId !== null && targetBranch.path.includes(userBranchId)) ||
                assignedBranchIds?.some((id) => targetBranch.path.includes(id)) ||
                false);
        case UserRole.SUPERVISOR:
            // Supervisor can access their assigned branches
            return (assignedBranchIds?.includes(targetBranchId) ||
                userBranchId === targetBranchId);
        case UserRole.USER:
            // Users can access their assigned branches
            return (assignedBranchIds?.includes(targetBranchId) ||
                userBranchId === targetBranchId);
        default:
            return false;
    }
}
// Function to get all accessible branches for a user
export function getAccessibleBranches(userRole, userBranchId, branchHierarchy, assignedBranchIds = []) {
    if (userRole === UserRole.ADMIN) {
        return branchHierarchy.map((b) => b.id);
    }
    const accessibleBranches = new Set();
    // Add assigned branches
    assignedBranchIds.forEach((id) => accessibleBranches.add(id));
    // Add default branch if exists
    if (userBranchId) {
        accessibleBranches.add(userBranchId);
    }
    switch (userRole) {
        case UserRole.BRANCH_MANAGER:
            // Add child branches for both default and assigned branches
            const managerBranches = [...accessibleBranches];
            branchHierarchy.forEach((branch) => {
                if (managerBranches.some((id) => branch.path.includes(id))) {
                    accessibleBranches.add(branch.id);
                }
            });
            break;
        case UserRole.SUPERVISOR:
        case UserRole.USER:
            // Only their assigned branches and default branch
            break;
        default:
            return [];
    }
    return Array.from(accessibleBranches);
}
// Utility for API routes to check permission
export function checkPermission(userRole, requiredPermission) {
    if (!userRole || !Object.values(UserRole).includes(userRole)) {
        return false;
    }
    return hasPermission(userRole, requiredPermission);
}
// Helper function to map UI permission strings to internal Permission enum
export function mapToPermission(permissionString) {
    // Handle case differences (API and UI might use different casing conventions)
    const normalizedString = permissionString.toUpperCase().replace(/ /g, '_');
    const found = Object.values(Permission).find(p => p.toUpperCase() === normalizedString);
    return found || null;
}
// Get display name for permission (useful for UI)
export function getPermissionDisplayName(permission) {
    return permission
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
// Group permissions by category for better UI organization
export function getGroupedPermissions() {
    return {
        'Admin Access': Object.values(Permission).filter(p => p.startsWith('ACCESS_') || p.startsWith('ASSIGN_') || p.startsWith('MANAGE_')),
        'Report Management': Object.values(Permission).filter(p => p.includes('REPORT')),
        'Branch Management': Object.values(Permission).filter(p => p.includes('BRANCH')),
        'User Management': Object.values(Permission).filter(p => p.includes('USER')),
        'Dashboard & Analytics': Object.values(Permission).filter(p => p.toLowerCase().includes('dashboard') || p.toLowerCase().includes('analytics')),
        'Audit & Logs': Object.values(Permission).filter(p => p.toLowerCase().includes('audit') || p.toLowerCase().includes('log')),
    };
}
