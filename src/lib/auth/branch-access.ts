// src/lib/auth/branch-access.ts
import { prisma } from "@/lib/prisma";
import { UserRole } from "./roles";
import { CACHE_TTL } from "./constants";

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

/**
 * Enhanced branch relationship maps for efficient lookups
 */
interface EnhancedBranchMaps {
  parentMap: Map<string, string | null>;
  childrenMap: Map<string, string[]>;
  hierarchyMap: Map<string, Set<string>>;  // Branch ID -> Set of all branches in hierarchy (including self)
  subBranchMap: Map<string, Set<string>>;  // Branch ID -> Set of all sub-branches
  allBranches: Map<string, Branch>;        // All branches by ID for quick lookup
  timestamp: number;
}

/**
 * User branch access cache to avoid repeated database queries
 */
interface BranchAccessCache {
  // Maps user IDs to sets of accessible branch IDs
  userAccessMap: Map<string, Set<string>>;
  // Branch relationship maps
  branchMaps: EnhancedBranchMaps;
  timestamp: number;
}

// Cache instances
let branchMapsCache: EnhancedBranchMaps | null = null;
let branchAccessCache: BranchAccessCache | null = null;

/**
 * Get enhanced branch relationship maps with caching
 * Pre-computes hierarchies and sub-branch relationships for faster lookups
 * @returns Maps for parent-child relationships and hierarchies
 */
export async function getEnhancedBranchMaps(): Promise<EnhancedBranchMaps> {
  const now = Date.now();

  // Return cached maps if they exist and are not expired
  if (branchMapsCache && (now - branchMapsCache.timestamp) < CACHE_TTL.BRANCH_MAPS) {
    return branchMapsCache;
  }

  // Get all branches to build relationship maps in a single query
  const branches = await prisma.branch.findMany({
    where: { isActive: true }
  });

  // Build maps for quick lookups
  const parentMap = new Map<string, string | null>();
  const childrenMap = new Map<string, string[]>();
  const hierarchyMap = new Map<string, Set<string>>();
  const subBranchMap = new Map<string, Set<string>>();
  const allBranches = new Map<string, Branch>();

  // Initialize maps
  branches.forEach(branch => {
    // Store branch in allBranches map
    allBranches.set(branch.id, branch);

    // Add to parent map (child -> parent)
    parentMap.set(branch.id, branch.parentId);

    // Initialize empty children arrays
    if (!childrenMap.has(branch.id)) {
      childrenMap.set(branch.id, []);
    }

    // Add to children map (parent -> children)
    if (branch.parentId) {
      const children = childrenMap.get(branch.parentId) || [];
      children.push(branch.id);
      childrenMap.set(branch.parentId, children);
    }

    // Initialize hierarchy and sub-branch sets
    hierarchyMap.set(branch.id, new Set([branch.id]));
    subBranchMap.set(branch.id, new Set<string>());
  });

  // Build hierarchy maps (branch and all its ancestors)
  branches.forEach(branch => {
    let currentId: string | null = branch.id;
    const branchHierarchy = hierarchyMap.get(branch.id)!;

    while (currentId) {
      const parentId = parentMap.get(currentId);
      if (parentId) {
        branchHierarchy.add(parentId);

        // Also add this branch to its parent's sub-branches
        const parentSubBranches = subBranchMap.get(parentId)!;
        parentSubBranches.add(branch.id);

        currentId = parentId;
      } else {
        currentId = null;
      }
    }
  });

  // Build complete sub-branch maps using depth-first traversal
  function buildSubBranchMap(branchId: string, visited = new Set<string>()): Set<string> {
    if (visited.has(branchId)) return new Set<string>();
    visited.add(branchId);

    const directChildren = childrenMap.get(branchId) || [];
    const allSubBranches = subBranchMap.get(branchId) || new Set<string>();

    directChildren.forEach(childId => {
      allSubBranches.add(childId);

      // Recursively add all sub-branches of this child
      const childSubBranches = buildSubBranchMap(childId, visited);
      childSubBranches.forEach(subBranchId => {
        allSubBranches.add(subBranchId);
      });
    });

    return allSubBranches;
  }

  // Process all branches to build complete sub-branch maps
  branches.forEach(branch => {
    buildSubBranchMap(branch.id);
  });

  // Cache the enhanced maps
  branchMapsCache = {
    parentMap,
    childrenMap,
    hierarchyMap,
    subBranchMap,
    allBranches,
    timestamp: now
  };

  return branchMapsCache;
}

/**
 * Build and cache user branch access relationships
 * @returns Cache containing user access maps and branch relationship maps
 */
async function getBranchAccessCache(): Promise<BranchAccessCache> {
  const now = Date.now();

  // Return cached data if it exists and is not expired
  if (branchAccessCache && (now - branchAccessCache.timestamp) < CACHE_TTL.USER_ACCESS) {
    return branchAccessCache;
  }

  // Get branch maps first
  const branchMaps = await getEnhancedBranchMaps();

  // Get all users with their roles and branch assignments in a single query
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      role: true,
      branchId: true,
      branchAssignments: {
        select: { branchId: true }
      },
      userRoles: {
        select: {
          role: { select: { name: true } },
          branchId: true
        }
      }
    }
  });

  // Build user access map
  const userAccessMap = new Map<string, Set<string>>();

  // Process each user
  for (const user of users) {
    const accessibleBranchIds = new Set<string>();

    // Admin can access all branches
    if (user.role === "ADMIN") {
      branchMaps.allBranches.forEach((_, branchId) => {
        accessibleBranchIds.add(branchId);
      });
    }
    // Branch manager can access their branch and all sub-branches
    else if (user.role === "BRANCH_MANAGER" && user.branchId) {
      // Add own branch
      accessibleBranchIds.add(user.branchId);

      // Add all sub-branches
      const subBranches = branchMaps.subBranchMap.get(user.branchId);
      if (subBranches) {
        subBranches.forEach(branchId => accessibleBranchIds.add(branchId));
      }

      // Add specifically assigned branches and their sub-branches
      user.branchAssignments.forEach(assignment => {
        accessibleBranchIds.add(assignment.branchId);

        const assignedSubBranches = branchMaps.subBranchMap.get(assignment.branchId);
        if (assignedSubBranches) {
          assignedSubBranches.forEach(branchId => accessibleBranchIds.add(branchId));
        }
      });
    }
    // Supervisor can access their branch and specifically assigned branches
    else if (user.role === "SUPERVISOR") {
      // Add own branch
      if (user.branchId) {
        accessibleBranchIds.add(user.branchId);
      }

      // Add specifically assigned branches
      user.branchAssignments.forEach(assignment => {
        accessibleBranchIds.add(assignment.branchId);
      });
    }
    // Regular users can only access their own branch
    else if (user.branchId) {
      accessibleBranchIds.add(user.branchId);
    }

    // Store in the map
    userAccessMap.set(user.id, accessibleBranchIds);
  }

  // Cache the results
  branchAccessCache = {
    userAccessMap,
    branchMaps,
    timestamp: now
  };

  return branchAccessCache;
}

/**
 * Track which users can access which branches
 * Uses in-memory maps for efficient lookups
 */
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

/**
 * Check if targetBranch is a sub-branch of parentBranch in the hierarchy
 * Uses in-memory maps for efficient lookups
 */
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

/**
 * Get all branches a user can access
 * Optimized to use in-memory maps and caching
 */
export async function getAccessibleBranches(userId: string): Promise<Branch[]> {
  try {
    // Get the branch access cache
    const cache = await getBranchAccessCache();

    // Get the set of accessible branch IDs for this user
    const accessibleBranchIds = cache.userAccessMap.get(userId);

    if (!accessibleBranchIds || accessibleBranchIds.size === 0) {
      return [];
    }

    // Convert the set of IDs to an array of Branch objects
    const branches: Branch[] = [];
    accessibleBranchIds.forEach(branchId => {
      const branch = cache.branchMaps.allBranches.get(branchId);
      if (branch) {
        branches.push(branch);
      }
    });

    return branches;
  } catch (error) {
    console.error("Error getting accessible branches:", error);

    // Fallback to the original implementation if there's an error
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
}

/**
 * Check if a user has access to a specific branch
 * Optimized to use in-memory maps for O(1) lookup
 */
export async function hasBranchAccess(userId: string, branchId: string): Promise<boolean> {
  try {
    // Get the branch access cache
    const cache = await getBranchAccessCache();

    // Get the set of accessible branch IDs for this user
    const accessibleBranchIds = cache.userAccessMap.get(userId);

    // O(1) lookup to check if the branch is accessible
    return accessibleBranchIds ? accessibleBranchIds.has(branchId) : false;
  } catch (error) {
    console.error("Error checking branch access:", error);

    // Fallback to the original implementation if there's an error
    const accessibleBranches = await getAccessibleBranches(userId);
    return accessibleBranches.some(branch => branch.id === branchId);
  }
}

/**
 * Check if a user has access to multiple branches at once
 * Optimized to use in-memory maps for efficient batch operations
 * @param userId The user ID to check access for
 * @param branchIds Array of branch IDs to check
 * @returns Map of branch IDs to boolean access results
 */
export async function checkBranchesAccess(userId: string, branchIds: string[]): Promise<Map<string, boolean>> {
  try {
    // Get the branch access cache
    const cache = await getBranchAccessCache();

    // Get the set of accessible branch IDs for this user
    const accessibleBranchIds = cache.userAccessMap.get(userId);

    // Create result map
    const result = new Map<string, boolean>();

    // Check each branch ID
    for (const branchId of branchIds) {
      result.set(branchId, accessibleBranchIds ? accessibleBranchIds.has(branchId) : false);
    }

    return result;
  } catch (error) {
    console.error("Error checking branches access:", error);

    // Fallback to individual checks if there's an error
    const result = new Map<string, boolean>();

    for (const branchId of branchIds) {
      result.set(branchId, await hasBranchAccess(userId, branchId));
    }

    return result;
  }
}

/**
 * Build a branch hierarchy tree from a flat list of branches
 * Uses in-memory processing for efficiency
 */
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
