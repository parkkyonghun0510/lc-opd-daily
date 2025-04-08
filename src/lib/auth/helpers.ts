/**
 * Helper functions for authentication and authorization
 * These functions provide reusable logic for common operations related to user permissions and branch access
 */

import { UserRole, Permission, hasPermission } from "./roles";
import { MANAGER_ROLE_NAMES, SUPERVISOR_ROLE_NAMES } from "./constants";
import { prisma } from "@/lib/prisma";

/**
 * Check if a user has a specific role
 * @param userRole The user's role to check
 * @param targetRoles Array of role names to match against
 * @returns Boolean indicating if the user has any of the target roles
 */
export function hasRole(userRole: string, targetRoles: string[]): boolean {
    return targetRoles.includes(userRole);
}

/**
 * Check if a user has manager-level permissions
 * @param userRole The user's role to check
 * @returns Boolean indicating if the user has manager-level permissions
 */
export function isManager(userRole: string): boolean {
    return MANAGER_ROLE_NAMES.includes(userRole);
}

/**
 * Check if a user has supervisor-level permissions
 * @param userRole The user's role to check
 * @returns Boolean indicating if the user has supervisor-level permissions
 */
export function isSupervisor(userRole: string): boolean {
    return SUPERVISOR_ROLE_NAMES.includes(userRole);
}

/**
 * Check if a user is an admin
 * @param userRole The user's role to check
 * @returns Boolean indicating if the user is an admin
 */
export function isAdmin(userRole: string): boolean {
    return userRole === UserRole.ADMIN || userRole === "admin" || userRole === "ADMIN";
}

/**
 * Check if a user has permission to perform an action on a specific branch
 * @param userId The user ID to check
 * @param branchId The branch ID to check access for
 * @param permission The permission to check
 * @returns Promise resolving to a boolean indicating if the user has the required permission for the branch
 */
export async function hasBranchPermission(
    userId: string,
    branchId: string,
    permission: Permission
): Promise<boolean> {
    // Get user with role information
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            role: true,
            branchId: true,
            branchAssignments: {
                select: { branchId: true }
            }
        }
    });

    if (!user) return false;

    // Check if user has the permission based on their role
    if (!hasPermission(user.role as UserRole, permission)) {
        return false;
    }

    // Admin can access all branches
    if (user.role === UserRole.ADMIN) {
        return true;
    }

    // Check if user is assigned to this branch
    if (user.branchId === branchId) {
        return true;
    }

    // Check if user has this branch in their assignments
    return user.branchAssignments.some(assignment => assignment.branchId === branchId);
}

/**
 * Get all users with a specific role
 * @param role The role to filter users by
 * @returns Promise resolving to an array of user IDs with the specified role
 */
export async function getUsersByRole(role: string): Promise<string[]> {
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { role },
                {
                    userRoles: {
                        some: {
                            role: {
                                name: role
                            }
                        }
                    }
                }
            ],
            isActive: true
        },
        select: { id: true }
    });

    return users.map(user => user.id);
}

/**
 * Get all users with a specific role in a specific branch
 * @param role The role to filter users by
 * @param branchId The branch ID to filter users by
 * @returns Promise resolving to an array of user IDs with the specified role in the specified branch
 */
export async function getUsersByRoleAndBranch(
    role: string,
    branchId: string
): Promise<string[]> {
    const users = await prisma.user.findMany({
        where: {
            OR: [
                {
                    role,
                    branchId
                },
                {
                    userRoles: {
                        some: {
                            role: {
                                name: role
                            },
                            branchId
                        }
                    }
                },
                {
                    branchAssignments: {
                        some: { branchId }
                    },
                    OR: [
                        { role },
                        {
                            userRoles: {
                                some: {
                                    role: {
                                        name: role
                                    }
                                }
                            }
                        }
                    ]
                }
            ],
            isActive: true
        },
        select: { id: true }
    });

    return users.map(user => user.id);
}

/**
 * Check if a branch is a parent of another branch
 * @param parentBranchId The potential parent branch ID
 * @param childBranchId The potential child branch ID
 * @returns Promise resolving to a boolean indicating if the parent-child relationship exists
 */
export async function isBranchParentOf(
    parentBranchId: string,
    childBranchId: string
): Promise<boolean> {
    // Get the child branch
    const childBranch = await prisma.branch.findUnique({
        where: { id: childBranchId },
        select: { parentId: true }
    });

    if (!childBranch) return false;

    // Direct parent check
    if (childBranch.parentId === parentBranchId) {
        return true;
    }

    // If not direct parent, check recursively
    if (childBranch.parentId) {
        return isBranchParentOf(parentBranchId, childBranch.parentId);
    }

    return false;
}

/**
 * Get all branches that a user can access
 * @param userId The user ID to check
 * @returns Promise resolving to an array of branch IDs the user can access
 */
export async function getUserAccessibleBranchIds(userId: string): Promise<string[]> {
    // Get user with role information
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            role: true,
            branchId: true,
            branchAssignments: {
                select: { branchId: true }
            }
        }
    });

    if (!user) return [];

    // Admin can access all branches
    if (user.role === UserRole.ADMIN) {
        const allBranches = await prisma.branch.findMany({
            where: { isActive: true },
            select: { id: true }
        });
        return allBranches.map(branch => branch.id);
    }

    // Get directly assigned branches
    const directBranchIds: string[] = [];

    if (user.branchId) {
        directBranchIds.push(user.branchId);
    }

    user.branchAssignments.forEach(assignment => {
        directBranchIds.push(assignment.branchId);
    });

    // For branch managers, also get sub-branches
    if (user.role === UserRole.BRANCH_MANAGER && directBranchIds.length > 0) {
        // Get all branches that have any of the direct branches as parent
        const subBranches = await prisma.branch.findMany({
            where: {
                parentId: {
                    in: directBranchIds
                },
                isActive: true
            },
            select: { id: true }
        });

        return [
            ...directBranchIds,
            ...subBranches.map(branch => branch.id)
        ];
    }

    return directBranchIds;
}
