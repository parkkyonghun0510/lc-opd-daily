export enum UserRole {
  ADMIN = "admin",
  BRANCH_MANAGER = "branch_manager",
  SUPERVISOR = "supervisor",
  USER = "user",
}

export enum Permission {
  // Report Permissions
  VIEW_REPORTS = "view_reports",
  CREATE_REPORTS = "create_reports",
  EDIT_REPORTS = "edit_reports",
  DELETE_REPORTS = "delete_reports",
  REVIEW_REPORTS = "review_reports",
  CONSOLIDATE_REPORTS = "consolidate_reports",
  EXPORT_REPORTS = "export_reports",
  ARCHIVE_REPORTS = "archive_reports",
  RESTORE_REPORTS = "restore_reports",

  // Branch Permissions
  VIEW_BRANCH = "view_branch",
  MANAGE_BRANCH = "manage_branch",
  CREATE_BRANCH = "create_branch",
  EDIT_BRANCH = "edit_branch",
  DELETE_BRANCH = "delete_branch",
  ASSIGN_BRANCH_MANAGER = "assign_branch_manager",
  VIEW_BRANCH_ANALYTICS = "view_branch_analytics",

  // User Permissions
  VIEW_USERS = "view_users",
  MANAGE_USERS = "manage_users",
  CREATE_USER = "create_user",
  EDIT_USER = "edit_user",
  DELETE_USER = "delete_user",
  ASSIGN_ROLES = "assign_roles",
  RESET_USER_PASSWORD = "reset_user_password",

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
    Permission.REVIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.ARCHIVE_REPORTS,
    Permission.VIEW_BRANCH,
    Permission.EDIT_BRANCH,
    Permission.VIEW_USERS,
    Permission.CREATE_USER,
    Permission.EDIT_USER,
    Permission.RESET_USER_PASSWORD,
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_BRANCH_ANALYTICS,
    Permission.CUSTOMIZE_DASHBOARD,
    Permission.VIEW_AUDIT_LOGS,
  ],
  [UserRole.SUPERVISOR]: [
    Permission.VIEW_REPORTS,
    Permission.CREATE_REPORTS,
    Permission.EDIT_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_BRANCH,
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_USERS,
  ],
  [UserRole.USER]: [
    Permission.VIEW_REPORTS,
    Permission.CREATE_REPORTS,
    Permission.VIEW_BRANCH,
    Permission.VIEW_DASHBOARD,
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

// Enhanced branch access control with hierarchy support
export function canAccessBranch(
  userRole: UserRole,
  userBranchId: string | null,
  targetBranchId: string,
  branchHierarchy?: BranchHierarchy[]
): boolean {
  if (userRole === UserRole.ADMIN) return true;
  if (!userBranchId) return false;

  // If no hierarchy provided, fall back to direct branch check
  if (!branchHierarchy) {
    return userBranchId === targetBranchId;
  }

  const userBranch = branchHierarchy.find((b) => b.id === userBranchId);
  const targetBranch = branchHierarchy.find((b) => b.id === targetBranchId);

  if (!userBranch || !targetBranch) return false;

  switch (userRole) {
    case UserRole.BRANCH_MANAGER:
      // Branch manager can access their branch and any child branches
      return targetBranch.path.includes(userBranchId);
    case UserRole.SUPERVISOR:
    case UserRole.USER:
      // These roles can only access their own branch
      return userBranchId === targetBranchId;
    default:
      return false;
  }
}

// Function to get all accessible branches for a user
export function getAccessibleBranches(
  userRole: UserRole,
  userBranchId: string | null,
  branchHierarchy: BranchHierarchy[]
): string[] {
  if (userRole === UserRole.ADMIN) {
    return branchHierarchy.map((b) => b.id);
  }

  if (!userBranchId) return [];

  const userBranch = branchHierarchy.find((b) => b.id === userBranchId);
  if (!userBranch) return [];

  switch (userRole) {
    case UserRole.BRANCH_MANAGER:
      // Return user's branch and all child branches
      return branchHierarchy
        .filter((b) => b.path.includes(userBranchId))
        .map((b) => b.id);
    case UserRole.SUPERVISOR:
    case UserRole.USER:
      // Only their own branch
      return [userBranchId];
    default:
      return [];
  }
}
