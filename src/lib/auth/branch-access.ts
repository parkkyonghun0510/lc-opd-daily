// src/lib/auth/branch-access.ts
import { prisma } from "@/lib/prisma";
import { UserRole } from "./roles";

export interface Branch {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  children?: Branch[];
}

export interface BranchHierarchy extends Branch {
  children: BranchHierarchy[];
}

// Track which users can access which branches
export function canAccessBranch(
  userRole: UserRole,
  userBranchId: string | null,
  targetBranchId: string,
  branchHierarchy: { id: string; parentId: string | null }[] = [],
  assignedBranchIds: string[] = [],
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
  branchHierarchy: { id: string; parentId: string | null }[],
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

/**
 * Recursively collect all descendant branches for a given set of branch IDs.
 * @param rootIds - The starting branch IDs
 * @param allBranches - All branches in the system
 * @returns All descendant branches (including the roots)
 */
function collectDescendantBranches(
  rootIds: string[],
  allBranches: Branch[],
): Branch[] {
  const branchMap = new Map<string, Branch>();
  allBranches.forEach((b) => branchMap.set(b.id, b));
  const result = new Map<string, Branch>();
  const stack = [...rootIds];
  while (stack.length) {
    const currentId = stack.pop();
    if (!currentId || result.has(currentId)) continue;
    const branch = branchMap.get(currentId);
    if (branch) {
      result.set(branch.id, branch);
      // Find children
      allBranches.forEach((b) => {
        if (b.parentId === branch.id) stack.push(b.id);
      });
    }
  }
  return Array.from(result.values());
}

/**
 * Get all branches a user can access, including all sub-branches for branch managers.
 * @param userId - The user ID
 * @returns Branch[] user can access
 */
export async function getAccessibleBranches(userId: string): Promise<Branch[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      branch: true,
      branchAssignments: { include: { branch: true } },
      userRoles: { include: { role: true, branch: true } },
    },
  });
  if (!user) return [];

  // Admin: all branches
  if (user.role === "ADMIN") {
    return await prisma.branch.findMany({ where: { isActive: true } });
  }

  // Branch Manager: assigned + all descendants
  if (user.role === "BRANCH_MANAGER") {
    // 1. Get all active branches
    const allBranches = await prisma.branch.findMany({
      where: { isActive: true },
    });
    // 2. Collect assigned branch IDs
    const assignedIds = [
      ...(user.branchId ? [user.branchId] : []),
      ...user.branchAssignments.map((a) => a.branchId),
    ];
    // 3. Recursively collect all descendants
    return collectDescendantBranches(assignedIds, allBranches);
  }

  // Other roles: just their branch
  if (user.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: user.branchId },
    });
    return branch ? [branch] : [];
  }

  return [];
}

export async function hasBranchAccess(
  userId: string,
  branchId: string,
): Promise<boolean> {
  const accessibleBranches = await getAccessibleBranches(userId);
  return accessibleBranches.some((branch) => branch.id === branchId);
}

export async function buildBranchHierarchy(
  branches: Branch[],
): Promise<BranchHierarchy[]> {
  const branchMap = new Map<string, BranchHierarchy>();
  const rootBranches: BranchHierarchy[] = [];

  // First pass: create all branch objects
  branches.forEach((branch) => {
    branchMap.set(branch.id, { ...branch, children: [] });
  });

  // Second pass: build the hierarchy
  branches.forEach((branch) => {
    const branchWithChildren = branchMap.get(branch.id)!;
    if (branch.parentId) {
      const parent = branchMap.get(branch.parentId);
      if (parent) {
        parent.children.push(branchWithChildren);
      }
    } else {
      rootBranches.push(branchWithChildren);
    }
  });

  return rootBranches;
}
