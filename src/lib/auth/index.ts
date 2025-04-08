/**
 * Auth module exports
 * This file exports all auth-related functions and constants from a single entry point
 */

// Export from roles.ts
export {
  UserRole,
  Permission,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  canAccessBranch,
  getAccessibleBranches as getAccessibleBranchesFromRoles,
  checkPermission,
  mapToPermission,
  getPermissionDisplayName,
  getGroupedPermissions
} from './roles';

// Export from branch-access.ts
export type { Branch, BranchHierarchy } from './branch-access';
export {
  getEnhancedBranchMaps,
  getAccessibleBranches,
  hasBranchAccess,
  checkBranchesAccess,
  buildBranchHierarchy
} from './branch-access';

// Export from constants.ts
export {
  MANAGER_ROLE_NAMES,
  SUPERVISOR_ROLE_NAMES,
  REPORTER_ROLE_NAMES,
  CACHE_TTL
} from './constants';

// Export from helpers.ts
export {
  hasRole,
  isManager,
  isSupervisor,
  isAdmin,
  hasBranchPermission,
  getUsersByRole,
  getUsersByRoleAndBranch,
  isBranchParentOf,
  getUserAccessibleBranchIds
} from './helpers';
