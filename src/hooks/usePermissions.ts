import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
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
  const [assignedBranchIds, setAssignedBranchIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userRole = session?.user?.role as UserRole;
  const userBranchId = session?.user?.branchId as string | null;

  // Fetch assigned branch IDs
  useEffect(() => {
    async function fetchAssignedBranches() {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/user-branch-assignments?userId=${session.user.id}`,
        );
        if (!response.ok) {
          throw new Error("Failed to fetch branch assignments");
        }
        const data = await response.json();
        // Extract branch IDs from assignments
        const branchIds = data.data.map(
          (assignment: any) => assignment.branch.id,
        );
        setAssignedBranchIds(branchIds);
      } catch (error) {
        console.error("Error fetching branch assignments:", error);
        // On error, use the default branch ID if available
        setAssignedBranchIds(userBranchId ? [userBranchId] : []);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAssignedBranches();
  }, [session?.user?.id, userBranchId]);

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
        assignedBranchIds,
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
        assignedBranchIds,
      ),

    // Check if user is admin
    isAdmin: userRole === UserRole.ADMIN,

    // Check if user is branch manager
    isBranchManager: userRole === UserRole.BRANCH_MANAGER,

    // Check if user is supervisor
    isSupervisor: userRole === UserRole.SUPERVISOR,

    // Check if user is regular user
    isUser: userRole === UserRole.USER,

    // Loading state
    isLoading,
  };
}
