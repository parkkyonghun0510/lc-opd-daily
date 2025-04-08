import { prisma } from '@/lib/prisma';
import { NotificationType } from './notificationTemplates';
import { getAccessibleBranches } from '@/lib/auth/branch-access';
import {
  MANAGER_ROLE_NAMES,
  SUPERVISOR_ROLE_NAMES,
  REPORTER_ROLE_NAMES,
  CACHE_TTL
} from '@/lib/auth/constants';

/**
 * Types for notification targeting
 */
interface NotificationTargetingData {
  userIds?: string[];
  userId?: string;
  submittedBy?: string;
  branchId?: string;
  branch?: { id: string };
  reportId?: string;
  commenters?: string[];
  commenter?: string;
  roles?: string[];
  allUsers?: boolean;
  includeSubBranches?: boolean;
  includeParentBranches?: boolean;
}

/**
 * Enhanced cache for branch relationship maps to avoid repeated database queries
 */
interface EnhancedBranchMaps {
  parentMap: Map<string, string | null>;
  childrenMap: Map<string, string[]>;
  hierarchyMap: Map<string, Set<string>>;  // Branch ID -> Set of all branches in hierarchy (including self)
  subBranchMap: Map<string, Set<string>>;  // Branch ID -> Set of all sub-branches
  timestamp: number;
}

let branchMapsCache: EnhancedBranchMaps | null = null;

/**
 * Get enhanced branch relationship maps with caching
 * Pre-computes hierarchies and sub-branch relationships for faster lookups
 * @returns Maps for parent-child relationships and hierarchies
 */
async function getEnhancedBranchMaps(): Promise<EnhancedBranchMaps> {
  const now = Date.now();

  // Return cached maps if they exist and are not expired
  if (branchMapsCache && (now - branchMapsCache.timestamp) < CACHE_TTL.BRANCH_MAPS) {
    return branchMapsCache;
  }

  // Get all branches to build relationship maps in a single query
  const branches = await prisma.branch.findMany({
    select: { id: true, parentId: true }
  });

  // Build maps for quick lookups
  const parentMap = new Map<string, string | null>();
  const childrenMap = new Map<string, string[]>();
  const hierarchyMap = new Map<string, Set<string>>();
  const subBranchMap = new Map<string, Set<string>>();

  // Initialize maps
  branches.forEach(branch => {
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
    timestamp: now
  };

  return branchMapsCache;
}

/**
 * Get all branches in the hierarchy efficiently, including the branch and all its ancestors
 * Uses pre-computed hierarchy map for O(1) lookup
 * @param branchId The branch ID to get hierarchy for
 * @returns Array of branch IDs in the hierarchy (including the branch itself)
 */
async function getBranchHierarchyIds(branchId: string): Promise<string[]> {
  const { hierarchyMap } = await getEnhancedBranchMaps();
  const hierarchy = hierarchyMap.get(branchId);
  return hierarchy ? Array.from(hierarchy) : [branchId];
}

/**
 * Get all sub-branches beneath a branch in the hierarchy efficiently
 * Uses pre-computed sub-branch map for O(1) lookup
 * @param branchId The parent branch ID
 * @returns Array of branch IDs below this branch
 */
async function getSubBranchIds(branchId: string): Promise<string[]> {
  const { subBranchMap } = await getEnhancedBranchMaps();
  const subBranches = subBranchMap.get(branchId);
  return subBranches ? Array.from(subBranches) : [];
}

/**
 * User query options for filtering users
 */
interface UserQueryOptions {
  branchIds?: string[];
  roleNames?: string[];
  isGlobal?: boolean;
  includeInactive?: boolean;
}

/**
 * User cache to avoid repeated database queries
 */
interface UserCache {
  byBranchAndRole: Map<string, string[]>;
  byBranch: Map<string, string[]>;
  byGlobalRole: Map<string, string[]>;
  allActive: string[] | null;
  timestamp: number;
}

let userCacheData: UserCache | null = null;

/**
 * Get users based on flexible criteria with caching
 * @param options Query options for filtering users
 * @returns Array of user IDs matching the criteria
 */
async function getUsers(options: UserQueryOptions): Promise<string[]> {
  const { branchIds, roleNames, isGlobal = false, includeInactive = false } = options;

  // Generate cache key for this specific query
  let cacheKey = '';
  if (isGlobal && roleNames) {
    cacheKey = `global:${roleNames.sort().join(',')}`;
  } else if (branchIds && roleNames) {
    cacheKey = `branch:${branchIds.sort().join(',')},roles:${roleNames.sort().join(',')}`;
  } else if (branchIds) {
    cacheKey = `branch:${branchIds.sort().join(',')}`;
  }

  const now = Date.now();

  // Initialize cache if needed
  if (!userCacheData || (now - userCacheData.timestamp) > CACHE_TTL.USER_CACHE) {
    userCacheData = {
      byBranchAndRole: new Map<string, string[]>(),
      byBranch: new Map<string, string[]>(),
      byGlobalRole: new Map<string, string[]>(),
      allActive: null,
      timestamp: now
    };
  }

  // Check cache for this specific query
  if (cacheKey) {
    if (isGlobal && roleNames && userCacheData.byGlobalRole.has(cacheKey)) {
      return userCacheData.byGlobalRole.get(cacheKey) || [];
    } else if (branchIds && roleNames && userCacheData.byBranchAndRole.has(cacheKey)) {
      return userCacheData.byBranchAndRole.get(cacheKey) || [];
    } else if (branchIds && userCacheData.byBranch.has(cacheKey)) {
      return userCacheData.byBranch.get(cacheKey) || [];
    }
  }

  // For "all active users" query
  if (!branchIds && !roleNames && !isGlobal && !includeInactive) {
    if (userCacheData.allActive) {
      return userCacheData.allActive;
    }
  }

  // Build the query conditions
  const conditions: any[] = [];

  // Role-based conditions
  if (roleNames && roleNames.length > 0) {
    if (isGlobal) {
      // Global role assignment (no branch restriction)
      conditions.push({
        userRoles: {
          some: {
            role: {
              name: {
                in: roleNames
              }
            },
            branchId: null
          }
        }
      });

      // Legacy global role
      conditions.push({
        role: {
          in: roleNames
        }
      });
    } else if (branchIds && branchIds.length > 0) {
      // Users with specific roles assigned to specific branches
      conditions.push({
        userRoles: {
          some: {
            role: {
              name: {
                in: roleNames
              }
            },
            branchId: {
              in: branchIds
            }
          }
        }
      });

      // Users with their primary branch set to one of these branches and having the roles
      conditions.push({
        branchId: {
          in: branchIds
        },
        userRoles: {
          some: {
            role: {
              name: {
                in: roleNames
              }
            }
          }
        }
      });
    }
  } else if (branchIds && branchIds.length > 0) {
    // Branch-based conditions without role filtering
    conditions.push({
      branchId: {
        in: branchIds
      }
    });

    conditions.push({
      branchAssignments: {
        some: {
          branchId: {
            in: branchIds
          }
        }
      }
    });
  }

  // If no conditions were added, return empty array
  if (conditions.length === 0) {
    return [];
  }

  // Execute the query
  const users = await prisma.user.findMany({
    where: {
      OR: conditions,
      isActive: includeInactive ? undefined : true
    },
    select: { id: true }
  });

  const userIds = users.map(user => user.id);

  // Cache the results
  if (cacheKey) {
    if (isGlobal && roleNames) {
      userCacheData.byGlobalRole.set(cacheKey, userIds);
    } else if (branchIds && roleNames) {
      userCacheData.byBranchAndRole.set(cacheKey, userIds);
    } else if (branchIds) {
      userCacheData.byBranch.set(cacheKey, userIds);
    }
  }

  // Cache all active users
  if (!branchIds && !roleNames && !isGlobal && !includeInactive) {
    userCacheData.allActive = userIds;
  }

  return userIds;
}

/**
 * Batch query function to get users with specific roles across multiple branches
 * @param branchIds Array of branch IDs to check
 * @param roleNames Array of role names to match
 * @returns Array of user IDs matching the criteria
 */
async function getUsersByRolesAndBranches(
  branchIds: string[],
  roleNames: string[]
): Promise<string[]> {
  return getUsers({
    branchIds,
    roleNames
  });
}

/**
 * Get global admins across the system in a single query
 * @returns Array of admin user IDs
 */
async function getGlobalAdmins(): Promise<string[]> {
  return getUsers({
    roleNames: ['admin', 'ADMIN'],
    isGlobal: true
  });
}

/**
 * Report details cache to avoid repeated database queries
 */
interface ReportDetailsCache {
  details: Map<string, { submittedBy: string; branchId: string } | null>;
  timestamp: number;
}

let reportDetailsCache: ReportDetailsCache | null = null;

/**
 * Get report details efficiently with caching
 * @param reportId The report ID
 * @returns Report details or null if not found
 */
async function getReportDetails(reportId: string): Promise<{ submittedBy: string; branchId: string } | null> {
  const now = Date.now();

  // Initialize cache if needed
  if (!reportDetailsCache || (now - reportDetailsCache.timestamp) > CACHE_TTL.REPORT_CACHE) {
    reportDetailsCache = {
      details: new Map(),
      timestamp: now
    };
  }

  // Check cache
  if (reportDetailsCache.details.has(reportId)) {
    return reportDetailsCache.details.get(reportId) || null;
  }

  // Query database
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { submittedBy: true, branchId: true }
  });

  // Cache result
  reportDetailsCache.details.set(reportId, report || null);

  return report || null;
}

/**
 * Get report submitter efficiently
 * @param reportId The report ID
 * @returns The submitter's user ID or null if not found
 */
async function getReportSubmitter(reportId: string): Promise<string | null> {
  const report = await getReportDetails(reportId);
  return report?.submittedBy || null;
}

/**
 * Batch query function to get users with management roles in multiple branch hierarchies
 * @param branchIds Array of branch IDs to get managers for
 * @returns Array of user IDs with management roles in any of the branch hierarchies
 */
async function getBatchManagersInBranchHierarchies(branchIds: string[]): Promise<string[]> {
  // Get all branch hierarchies in a single operation
  const branchMaps = await getEnhancedBranchMaps();

  // Collect all branch IDs in all hierarchies
  const allHierarchyBranchIds = new Set<string>();

  branchIds.forEach(branchId => {
    const hierarchy = branchMaps.hierarchyMap.get(branchId);
    if (hierarchy) {
      hierarchy.forEach(id => allHierarchyBranchIds.add(id));
    } else {
      allHierarchyBranchIds.add(branchId);
    }
  });

  // Get managers for all branches in a single query
  return getUsers({
    branchIds: Array.from(allHierarchyBranchIds),
    roleNames: MANAGER_ROLE_NAMES
  });
}

/**
 * Get users with management roles in a branch hierarchy
 * @param branchId The branch ID to get hierarchy for
 * @returns Array of user IDs with management roles in the hierarchy
 */
async function getManagersInBranchHierarchy(branchId: string): Promise<string[]> {
  return getBatchManagersInBranchHierarchies([branchId]);
}

/**
 * Handle report submitted notification targeting
 */
async function handleReportSubmittedNotification(
  branchId: string | null,
  userIds: string[]
): Promise<string[]> {
  if (!branchId) return userIds;

  // Get all managers in the hierarchy
  const managersInHierarchy = await getManagersInBranchHierarchy(branchId);
  userIds.push(...managersInHierarchy);

  // Add global admins
  const globalAdmins = await getGlobalAdmins();
  userIds.push(...globalAdmins);

  return userIds;
}

/**
 * Handle report approval/rejection notification targeting
 */
async function handleReportStatusChangeNotification(
  reportId: string | undefined,
  userIds: string[]
): Promise<string[]> {
  // ONLY notify the report submitter
  if (!reportId) return [];

  const submitterId = await getReportSubmitter(reportId);
  if (submitterId) {
    return [submitterId]; // Reset array to only include submitter
  }

  return []; // Report or submitter not found, notify no one
}

/**
 * Handle report needs revision notification targeting
 */
async function handleReportNeedsRevisionNotification(
  reportId: string | undefined,
  userIds: string[]
): Promise<string[]> {
  if (!reportId) return userIds;

  const reportDetails = await getReportDetails(reportId);
  if (!reportDetails) return userIds;

  // Add the report submitter
  userIds.push(reportDetails.submittedBy);

  // Get the submitter's branch
  const submitter = await prisma.user.findUnique({
    where: { id: reportDetails.submittedBy },
    select: { branchId: true }
  });

  if (submitter?.branchId) {
    // Get all supervisors and managers for this branch
    const supervisorsAndManagers = await getUsers({
      branchIds: [submitter.branchId],
      roleNames: [...SUPERVISOR_ROLE_NAMES, ...MANAGER_ROLE_NAMES]
    });

    userIds.push(...supervisorsAndManagers);
  }

  return userIds;
}

/**
 * Handle approval pending notification targeting
 */
async function handleApprovalPendingNotification(
  branchId: string | null,
  userIds: string[]
): Promise<string[]> {
  if (!branchId) return userIds;

  // Get all managers/approvers in the hierarchy
  const approversInHierarchy = await getManagersInBranchHierarchy(branchId);
  userIds.push(...approversInHierarchy);

  // Add global admins
  const globalAdmins = await getGlobalAdmins();
  userIds.push(...globalAdmins);

  return userIds;
}

/**
 * Handle report reminder/overdue notification targeting
 */
async function handleReportReminderNotification(
  branchId: string | null,
  userIds: string[]
): Promise<string[]> {
  if (!branchId) return userIds;

  // Get all users for this branch who can submit reports
  const reporterUsers = await getUsers({
    branchIds: [branchId],
    roleNames: REPORTER_ROLE_NAMES
  });

  userIds.push(...reporterUsers);

  // Add branch managers
  const branchManagers = await getUsersByRolesAndBranches(
    [branchId],
    MANAGER_ROLE_NAMES
  );

  userIds.push(...branchManagers);

  return userIds;
}

/**
 * Handle comment added notification targeting
 */
async function handleCommentAddedNotification(
  reportId: string | undefined,
  data: NotificationTargetingData,
  userIds: string[]
): Promise<string[]> {
  if (!reportId) return userIds;

  const reportDetails = await getReportDetails(reportId);
  if (!reportDetails) return userIds;

  // 1. Add report submitter
  userIds.push(reportDetails.submittedBy);

  // 2. Add branch managers
  const branchManagers = await getUsers({
    branchIds: [reportDetails.branchId],
    roleNames: MANAGER_ROLE_NAMES
  });

  userIds.push(...branchManagers);

  // 3. Add users involved in prior comments (if tracked)
  if (data.commenters && Array.isArray(data.commenters)) {
    userIds.push(...data.commenters);
  }

  // Skip the commenter (don't notify the person who made the comment)
  if (data.commenter) {
    userIds = userIds.filter(id => id !== data.commenter);
  }

  return userIds;
}

/**
 * Get users from a specific branch
 */
async function getUsersFromBranch(branchId: string): Promise<string[]> {
  return getUsers({
    branchIds: [branchId]
  });
}

/**
 * Get users from branches with hierarchy consideration
 * Uses pre-computed branch maps for efficient hierarchy traversal
 */
async function getUsersFromBranchHierarchy(
  branchId: string,
  includeSubBranches: boolean,
  includeParentBranches: boolean
): Promise<string[]> {
  const branchMaps = await getEnhancedBranchMaps();
  let branchIds: string[] = [branchId];

  if (includeSubBranches) {
    const subBranches = branchMaps.subBranchMap.get(branchId);
    if (subBranches) {
      branchIds = [...branchIds, ...Array.from(subBranches)];
    }
  } else if (includeParentBranches) {
    const hierarchy = branchMaps.hierarchyMap.get(branchId);
    if (hierarchy) {
      branchIds = Array.from(hierarchy);
    }
  }

  return getUsers({
    branchIds
  });
}

/**
 * Get all active users in the system
 */
async function getAllActiveUsers(): Promise<string[]> {
  const allUsers = await prisma.user.findMany({
    where: {
      isActive: true
    },
    select: { id: true }
  });

  return allUsers.map(user => user.id);
}

/**
 * Handle system notification targeting
 */
async function handleSystemNotification(
  data: NotificationTargetingData,
  userIds: string[]
): Promise<string[]> {
  // System notifications can target users by roles or all users
  if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
    // Get all users with specified roles
    const usersWithRoles = await getUsers({
      roleNames: data.roles
    });

    userIds.push(...usersWithRoles);
  } else if (data.allUsers) {
    // Send to all active users
    const allUsers = await getAllActiveUsers();
    userIds.push(...allUsers);
  } else if (data.branchId) {
    // Handle branch-based targeting with hierarchy options
    const branchUsers = await getUsersFromBranchHierarchy(
      data.branchId,
      !!data.includeSubBranches,
      !!data.includeParentBranches
    );

    userIds.push(...branchUsers);
  }

  return userIds;
}

/**
 * Get user IDs that should receive a specific notification
 * Returns an array of user IDs who should receive the notification
 */
export async function getUsersForNotification(
  type: NotificationType,
  data: NotificationTargetingData
): Promise<string[]> {
  // Default to empty array
  let userIds: string[] = [];

  // If specific userIds are provided, use them directly
  if (data.userIds && Array.isArray(data.userIds) && data.userIds.length > 0) {
    return [...new Set(data.userIds)]; // Remove duplicates
  }

  // If a submitter is provided, always include them in target users
  if (data.userId || data.submittedBy) {
    const submitterId = data.userId || data.submittedBy;
    if (submitterId && !userIds.includes(submitterId)) {
      userIds.push(submitterId);
    }
  }

  try {
    // Extract branchId directly or from the branch object if provided
    const branchId = data.branchId || (data.branch?.id || null);

    // Check if we need a branch ID for this notification type
    const requiresBranchId = ![
      NotificationType.REPORT_APPROVED,
      NotificationType.REPORT_REJECTED,
      NotificationType.SYSTEM_NOTIFICATION
    ].includes(type);

    if (!branchId && requiresBranchId) {
      console.log('No branch ID provided for notification targeting.');
      return [...new Set(userIds)]; // Return unique user IDs
    }

    // For system notifications without branch targeting, we might still need global admins
    if (!branchId && type === NotificationType.SYSTEM_NOTIFICATION) {
      const globalAdmins = await getGlobalAdmins();
      userIds.push(...globalAdmins);
      return [...new Set(userIds)]; // Return unique user IDs
    }

    // Handle different notification types with dedicated functions
    switch (type) {
      case NotificationType.REPORT_SUBMITTED:
        userIds = await handleReportSubmittedNotification(branchId, userIds);
        break;

      case NotificationType.REPORT_APPROVED:
      case NotificationType.REPORT_REJECTED:
        userIds = await handleReportStatusChangeNotification(data.reportId, userIds);
        break;

      case NotificationType.REPORT_NEEDS_REVISION:
        userIds = await handleReportNeedsRevisionNotification(data.reportId, userIds);
        break;

      case NotificationType.APPROVAL_PENDING:
        userIds = await handleApprovalPendingNotification(branchId, userIds);
        break;

      case NotificationType.REPORT_REMINDER:
      case NotificationType.REPORT_OVERDUE:
        userIds = await handleReportReminderNotification(branchId, userIds);
        break;

      case NotificationType.COMMENT_ADDED:
        userIds = await handleCommentAddedNotification(data.reportId, data, userIds);
        break;

      case NotificationType.SYSTEM_NOTIFICATION:
        userIds = await handleSystemNotification(data, userIds);
        break;

      default:
        console.log(`Unhandled notification type: ${type}`);
        break;
    }
  } catch (error) {
    console.error(`Error getting users for notification type ${type}:`, error);
    // Return current user IDs even on error, to ensure at least some notifications are sent
  }

  // Remove duplicates and return
  return [...new Set(userIds)];
}
