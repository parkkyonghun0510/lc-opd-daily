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
export async function getAccessibleBranches(userId: string): Promise<Branch[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      branch: true,
      branchAssignments: {
        include: {
          branch: true,
        },
      },
      userRoles: {
        include: {
          role: true,
          branch: true,
        },
      },
    },
  });

  if (!user) {
    return [];
  }

  // If user is admin, they have access to all branches
  if (user.role === "ADMIN") {
    const allBranches = await prisma.branch.findMany({
      where: { isActive: true },
    });
    return allBranches;
  }

  // For branch managers, get their assigned branches and sub-branches
  if (user.role === "BRANCH_MANAGER") {
    const assignedBranches = await prisma.branch.findMany({
      where: {
        OR: [
          { id: user.branchId || "" },
          {
            id: {
              in: user.branchAssignments.map(assignment => assignment.branchId),
            },
          },
        ],
        isActive: true,
      },
    });

    // Get all sub-branches
    const subBranches = await prisma.branch.findMany({
      where: {
        parentId: {
          in: assignedBranches.map(branch => branch.id),
        },
        isActive: true,
      },
    });

    return [...assignedBranches, ...subBranches];
  }

  // For other roles, only get their assigned branch
  if (user.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: user.branchId },
    });
    return branch ? [branch] : [];
  }

  return [];
}

export async function hasBranchAccess(userId: string, branchId: string): Promise<boolean> {
  const accessibleBranches = await getAccessibleBranches(userId);
  return accessibleBranches.some(branch => branch.id === branchId);
}

export async function buildBranchHierarchy(branches: Branch[]): Promise<BranchHierarchy[]> {
  const branchMap = new Map<string, BranchHierarchy>();
  const rootBranches: BranchHierarchy[] = [];

  // First pass: create all branch objects
  branches.forEach(branch => {
    branchMap.set(branch.id, { ...branch, children: [] });
  });

  // Second pass: build the hierarchy
  branches.forEach(branch => {
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
