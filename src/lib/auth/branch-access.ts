// src/lib/auth/branch-access.ts
import { UserRole } from "./roles";

// Track which users can access which branches
export function canAccessBranch(
  userRole: UserRole,
  userBranchId: string | null,
  targetBranchId: string,
  branchHierarchy: { id: string; parentId: string | null }[] = [],
  assignedBranchIds: string[] = []
): boolean {
  // Admin can access all branches
  if (userRole === UserRole.ADMIN) {
    return true;
  }

  // Branch manager can access their own branch
  if (userRole === UserRole.BRANCH_MANAGER) {
    if (userBranchId === targetBranchId) {
      return true;
    }

    // Branch managers can access sub-branches in the hierarchy
    return isSubBranch(userBranchId, targetBranchId, branchHierarchy);
  }

  // Supervisor can access their own branch and any specifically assigned branches
  if (userRole === UserRole.SUPERVISOR) {
    return (
      userBranchId === targetBranchId ||
      assignedBranchIds.includes(targetBranchId)
    );
  }

  // Regular users can only access their own branch
  return userBranchId === targetBranchId;
}

// Check if targetBranch is a sub-branch of parentBranch in the hierarchy
function isSubBranch(
  parentBranchId: string | null,
  targetBranchId: string,
  branchHierarchy: { id: string; parentId: string | null }[]
): boolean {
  if (!parentBranchId) return false;

  const targetBranch = branchHierarchy.find((b) => b.id === targetBranchId);
  if (!targetBranch) return false;

  // Direct child
  if (targetBranch.parentId === parentBranchId) {
    return true;
  }

  // Check recursively for indirect children
  if (targetBranch.parentId) {
    return isSubBranch(parentBranchId, targetBranch.parentId, branchHierarchy);
  }

  return false;
}

// Get all branches a user can access
export function getAccessibleBranches(
  userRole: UserRole,
  userBranchId: string | null,
  branchHierarchy: { id: string; parentId: string | null }[],
  assignedBranchIds: string[] = []
): string[] {
  // Admin can access all branches
  if (userRole === UserRole.ADMIN) {
    return branchHierarchy.map((b) => b.id);
  }

  // Branch manager can access their branch and sub-branches
  if (userRole === UserRole.BRANCH_MANAGER && userBranchId) {
    const accessibleBranches = [userBranchId];

    // Add all sub-branches
    branchHierarchy.forEach((branch) => {
      if (isSubBranch(userBranchId, branch.id, branchHierarchy)) {
        accessibleBranches.push(branch.id);
      }
    });

    return accessibleBranches;
  }

  // Supervisors can access their branch and assigned branches
  if (userRole === UserRole.SUPERVISOR) {
    return [...(userBranchId ? [userBranchId] : []), ...assignedBranchIds];
  }

  // Regular users can only access their branch
  return userBranchId ? [userBranchId] : [];
}
