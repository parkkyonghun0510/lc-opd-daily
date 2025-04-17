export enum UserRole {
  ADMIN = "ADMIN",
  BRANCH_MANAGER = "BRANCH_MANAGER",
  SUPERVISOR = "SUPERVISOR",
  USER = "USER",
}

export enum Permission {
  // Admin Access
  ACCESS_ADMIN = "ACCESS_ADMIN",
  ASSIGN_ROLES = "ASSIGN_ROLES",
  MANAGE_USERS = "MANAGE_USERS",
  MANAGE_BRANCHES = "MANAGE_BRANCHES",
  MANAGE_SETTINGS = "MANAGE_SETTINGS",

  // Report Permissions
  VIEW_REPORTS = "VIEW_REPORTS",
  CREATE_REPORTS = "CREATE_REPORTS",
  EDIT_REPORTS = "EDIT_REPORTS",
  DELETE_REPORTS = "DELETE_REPORTS",
  REVIEW_REPORTS = "REVIEW_REPORTS",
  CONSOLIDATE_REPORTS = "CONSOLIDATE_REPORTS",
  RESTORE_REPORTS = "RESTORE_REPORTS",
  EXPORT_REPORTS = "EXPORT_REPORTS",
  APPROVE_REPORTS = "APPROVE_REPORTS",
  ARCHIVE_REPORTS = "ARCHIVE_REPORTS",
  // Report Ownership Permissions
  VIEW_OWN_REPORTS = "VIEW_OWN_REPORTS",
  EDIT_OWN_REPORTS = "EDIT_OWN_REPORTS",
  DELETE_OWN_REPORTS = "DELETE_OWN_REPORTS",
  // Branch Permissions
  VIEW_BRANCH = "VIEW_BRANCH",
  MANAGE_BRANCH = "MANAGE_BRANCH",
  CREATE_BRANCH = "CREATE_BRANCH",
  EDIT_BRANCH = "EDIT_BRANCH",
  DELETE_BRANCH = "DELETE_BRANCH",
  ASSIGN_BRANCH_MANAGER = "ASSIGN_BRANCH_MANAGER",
  VIEW_BRANCH_ANALYTICS = "VIEW_BRANCH_ANALYTICS",

  // User Permissions
  VIEW_USERS = "VIEW_USERS",
  CREATE_USER = "CREATE_USER",
  EDIT_USER = "EDIT_USER",
  DELETE_USER = "DELETE_USER",
  RESET_USER_PASSWORD = "RESET_USER_PASSWORD",

  // Dashboard Permissions
  VIEW_DASHBOARD = "view_dashboard",
  VIEW_ANALYTICS = "view_analytics",
  EXPORT_ANALYTICS = "export_analytics",
  CUSTOMIZE_DASHBOARD = "customize_dashboard",

  // Audit Permissions
  VIEW_AUDIT_LOGS = "view_audit_logs",
  EXPORT_AUDIT_LOGS = "export_audit_logs",
}

// Define role-based permissions
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
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

export interface BranchHierarchy {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  path: string[];
}

// Helper functions
export function hasPermission(
  userRole: UserRole,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
}

export function hasAnyPermission(
  userRole: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(userRole, permission));
}

export function hasAllPermissions(
  userRole: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(userRole, permission));
}

// Get all permissions for a role
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

// Enhanced branch access control with hierarchy and multi-branch assignment support
export function canAccessBranch(
  userRole: UserRole,
  userBranchId: string | null,
  targetBranchId: string,
  branchHierarchy?: BranchHierarchy[],
  assignedBranchIds?: string[]
): boolean {
  if (userRole === UserRole.ADMIN) return true;
  if (!userBranchId && !assignedBranchIds?.length) return false;

  // Check if user has direct assignment to target branch
  if (assignedBranchIds?.includes(targetBranchId)) return true;

  // If no hierarchy provided, fall back to direct branch check
  if (!branchHierarchy) {
    return (
      userBranchId === targetBranchId ||
      assignedBranchIds?.includes(targetBranchId) ||
      false
    );
  }

  const userBranch = branchHierarchy.find((b) => b.id === userBranchId);
  const targetBranch = branchHierarchy.find((b) => b.id === targetBranchId);

  if (!userBranch || !targetBranch) return false;

  switch (userRole) {
    case UserRole.BRANCH_MANAGER:
      // Branch manager can access their default branch, assigned branches, and any child branches
      return (
        (userBranchId !== null && targetBranch.path.includes(userBranchId)) ||
        assignedBranchIds?.some((id) => targetBranch.path.includes(id)) ||
        false
      );
    case UserRole.SUPERVISOR:
      // Supervisor can access their assigned branches
      return (
        assignedBranchIds?.includes(targetBranchId) ||
        userBranchId === targetBranchId
      );
    case UserRole.USER:
      // Users can access their assigned branches
      return (
        assignedBranchIds?.includes(targetBranchId) ||
        userBranchId === targetBranchId
      );
    default:
      return false;
  }
}

// Function to get all accessible branches for a user
export function getAccessibleBranches(
  userRole: UserRole,
  userBranchId: string | null,
  branchHierarchy: BranchHierarchy[],
  assignedBranchIds: string[] = []
): string[] {
  if (userRole === UserRole.ADMIN) {
    return branchHierarchy.map((b) => b.id);
  }

  const accessibleBranches = new Set<string>();

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
export function checkPermission(
  userRole: string,
  requiredPermission: Permission
): boolean {
  if (!userRole || !Object.values(UserRole).includes(userRole as UserRole)) {
    return false;
  }
  return hasPermission(userRole as UserRole, requiredPermission);
}

// Helper function to map UI permission strings to internal Permission enum
export function mapToPermission(permissionString: string): Permission | null {
  // Handle case differences (API and UI might use different casing conventions)
  const normalizedString = permissionString.toUpperCase().replace(/ /g, '_');
  const found = Object.values(Permission).find(
    p => p.toUpperCase() === normalizedString
  );
  return found || null;
}

// Get display name for permission (useful for UI)
export function getPermissionDisplayName(permission: Permission): string {
  return permission
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Group permissions by category for better UI organization
export function getGroupedPermissions(): Record<string, Permission[]> {
  return {
    'Admin Access': Object.values(Permission).filter(p => p.startsWith('ACCESS_') || p.startsWith('ASSIGN_') || p.startsWith('MANAGE_')),
    'Report Management': Object.values(Permission).filter(p => p.includes('REPORT')),
    'Branch Management': Object.values(Permission).filter(p => p.includes('BRANCH')),
    'User Management': Object.values(Permission).filter(p => p.includes('USER')),
    'Dashboard & Analytics': Object.values(Permission).filter(p => p.toLowerCase().includes('dashboard') || p.toLowerCase().includes('analytics')),
    'Audit & Logs': Object.values(Permission).filter(p => p.toLowerCase().includes('audit') || p.toLowerCase().includes('log')),
  };
}
