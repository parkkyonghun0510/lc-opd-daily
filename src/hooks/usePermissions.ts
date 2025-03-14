import { useSession } from "next-auth/react";
import {
  Permission,
  UserRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessBranch,
} from "@/lib/auth/roles";

export function usePermissions() {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole;
  const userBranchId = session?.user?.branchId as string;
  const assignedBranchIds =
    (session?.user?.assignedBranchIds as string[]) || [];

  return {
    // Check if user has a specific permission
    can: (permission: Permission) => hasPermission(userRole, permission),

    // Check if user has any of the given permissions
    canAny: (permissions: Permission[]) =>
      hasAnyPermission(userRole, permissions),

    // Check if user has all of the given permissions
    canAll: (permissions: Permission[]) =>
      hasAllPermissions(userRole, permissions),

    // Check if user can access a specific branch
    canAccessBranch: (branchId: string, branchHierarchy?: BranchHierarchy[]) =>
      canAccessBranch(
        userRole,
        userBranchId,
        branchId,
        branchHierarchy,
        assignedBranchIds
      ),

    // Get user's role
    role: userRole,

    // Get user's branch ID (default branch)
    branchId: userBranchId,

    // Get user's assigned branch IDs
    assignedBranchIds,

    // Get all accessible branch IDs
    getAccessibleBranches: (branchHierarchy: BranchHierarchy[]) =>
      getAccessibleBranches(
        userRole,
        userBranchId,
        branchHierarchy,
        assignedBranchIds
      ),

    // Check if user is admin
    isAdmin: userRole === UserRole.ADMIN,

    // Check if user is branch manager
    isBranchManager: userRole === UserRole.BRANCH_MANAGER,

    // Check if user is supervisor
    isSupervisor: userRole === UserRole.SUPERVISOR,

    // Check if user is regular user
    isUser: userRole === UserRole.USER,
  };
}
