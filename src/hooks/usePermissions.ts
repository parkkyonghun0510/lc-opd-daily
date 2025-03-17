import { useSession } from "next-auth/react";
import {
  Permission,
  UserRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessBranch,
  getAccessibleBranches as getAccessibleBranchesUtil,
  BranchHierarchy as RolesBranchHierarchy,
} from "@/lib/auth/roles";
import { BranchHierarchy } from "@/lib/types/branch";

// Add assignedBranchIds to Session type
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      username: string;
      branchId: string | null;
      assignedBranchIds?: string[];
      [key: string]: unknown;
    };
  }
}

// A function to convert BranchHierarchy[] from types/branch to roles format
function convertBranchHierarchy(hierarchy: any[]): RolesBranchHierarchy[] {
  return hierarchy.map((branch) => ({
    id: branch.id,
    name: branch.name,
    parentId: branch.parentId || null,
    level: branch.level,
    path: branch.path,
  }));
}

export function usePermissions() {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole;
  const userBranchId = session?.user?.branchId as string | null;
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
    canAccessBranch: (branchId: string, branchHierarchy?: any[]) =>
      canAccessBranch(
        userRole,
        userBranchId,
        branchId,
        branchHierarchy ? convertBranchHierarchy(branchHierarchy) : undefined,
        assignedBranchIds
      ),

    // Get user's role
    role: userRole,

    // Get user's branch ID (default branch)
    branchId: userBranchId,

    // Get user's assigned branch IDs
    assignedBranchIds,

    // Get all accessible branch IDs
    getAccessibleBranches: (branchHierarchy: any[]) =>
      getAccessibleBranchesUtil(
        userRole,
        userBranchId,
        convertBranchHierarchy(branchHierarchy),
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
