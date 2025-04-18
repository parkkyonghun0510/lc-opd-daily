import { prisma } from '@/lib/prisma';
import { NotificationType } from './notificationTemplates';
import { getAccessibleBranches } from '@/lib/auth/branch-access';

/**
 * Get all branches in the hierarchy, including the branch and all its ancestors
 * @param branchId The branch ID to get hierarchy for
 * @returns Array of branch IDs in the hierarchy (including the branch itself)
 */
async function getBranchHierarchy(branchId: string): Promise<string[]> {
  const branchIds = new Set<string>();
  branchIds.add(branchId);

  // Find the branch and all its ancestors
  let currentBranchId: string | null = branchId;
  while (currentBranchId) {
    const branch: { parentId: string | null } | null = await prisma.branch.findUnique({
      where: { id: currentBranchId },
      select: { parentId: true }
    });

    if (branch?.parentId) {
      branchIds.add(branch.parentId);
      currentBranchId = branch.parentId;
    } else {
      currentBranchId = null;
    }
  }

  return Array.from(branchIds);
}

/**
 * Get all sub-branches beneath a branch in the hierarchy
 * @param branchId The parent branch ID
 * @returns Array of branch IDs below this branch
 */
async function getSubBranches(branchId: string): Promise<string[]> {
  // Function to recursively find child branches
  async function findChildBranches(parentId: string): Promise<string[]> {
    const childBranches = await prisma.branch.findMany({
      where: { parentId },
      select: { id: true }
    });

    const childIds = childBranches.map(b => b.id);
    const descendantIds: string[] = [];

    // Recursively get children of children
    for (const childId of childIds) {
      const descendants = await findChildBranches(childId);
      descendantIds.push(...descendants);
    }

    return [...childIds, ...descendantIds];
  }

  return await findChildBranches(branchId);
}

/**
 * Get managers of a branch (including roles with management permissions)
 * @param branchId The branch ID
 * @returns Array of user IDs who manage this branch
 */
async function getBranchManagers(branchId: string): Promise<string[]> {
  const managers = await prisma.user.findMany({
    where: {
      OR: [
        {
          // Direct branch managers
          userRoles: {
            some: {
              role: {
                name: {
                  in: ['manager', 'admin', 'approver', 'branch_manager', 'BRANCH_MANAGER']
                }
              },
              branchId
            }
          },
          isActive: true
        },
        {
          // Users with their primary branch set to this branch and have manager role
          branchId,
          userRoles: {
            some: {
              role: {
                name: {
                  in: ['manager', 'admin', 'approver', 'branch_manager', 'BRANCH_MANAGER']
                }
              }
            }
          },
          isActive: true
        }
      ]
    },
    select: { id: true }
  });

  return managers.map(manager => manager.id);
}

/**
 * Get global admins across the system
 * @returns Array of admin user IDs
 */
async function getGlobalAdmins(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      OR: [
        {
          role: 'ADMIN',
          isActive: true
        },
        {
          userRoles: {
            some: {
              role: {
                name: 'admin'
              },
              branchId: null // Global admins have no branch restriction
            }
          },
          isActive: true
        }
      ]
    },
    select: { id: true }
  });

  return admins.map(admin => admin.id);
}

/**
 * Get user IDs that should receive a specific notification
 * Returns an array of user IDs who should receive the notification
 */
export async function getUsersForNotification(
  type: NotificationType, data: Record<string, any>): Promise<string[]> {
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
    // Always include global admins for all notifications
    const globalAdmins = await getGlobalAdmins();
    userIds.push(...globalAdmins);

    // Extract branchId directly or from the branch object if provided
    const branchId = data.branchId || (data.branch?.id || null);

    if (!branchId) {
      //console.log('No branch ID provided for notification targeting.');
      return [...new Set(userIds)]; // Return unique user IDs
    }

    switch (type) {
      case NotificationType.REPORT_SUBMITTED: {
        // 1. Include branch managers of the current branch
        const directManagers = await getBranchManagers(branchId);
        userIds.push(...directManagers);

        // 2. Include managers of parent branches (notify up the hierarchy)
        const parentBranches = await getBranchHierarchy(branchId);
        for (const parentId of parentBranches) {
          if (parentId !== branchId) { // Skip the current branch as we already added its managers
            const parentManagers = await getBranchManagers(parentId);
            userIds.push(...parentManagers);
          }
        }
        break;
      }

      case NotificationType.REPORT_APPROVED: {
        // ONLY notify the report submitter
        if (data.reportId) {
          const report = await prisma.report.findUnique({
            where: { id: data.reportId },
            select: { submittedBy: true }
          });
          if (report?.submittedBy) {
            userIds = [report.submittedBy]; // Reset array to only include submitter
          } else {
            userIds = []; // Report or submitter not found, notify no one
          }
        } else {
          userIds = []; // Cannot target without reportId
        }
        break;
      }

      case NotificationType.REPORT_REJECTED: {
        // ONLY notify the report submitter
        if (data.reportId) {
          const report = await prisma.report.findUnique({
            where: { id: data.reportId },
            select: { submittedBy: true }
          });
          if (report?.submittedBy) {
            userIds = [report.submittedBy]; // Reset array to only include submitter
          } else {
            userIds = []; // Report or submitter not found, notify no one
          }
        } else {
          userIds = []; // Cannot target without reportId
        }
        break;
      }

      case NotificationType.REPORT_NEEDS_REVISION: {
        // Similar to rejection but focus on submitter and their immediate supervisors
        if (data.reportId) {
          const report = await prisma.report.findUnique({
            where: { id: data.reportId },
            select: { submittedBy: true, branchId: true }
          });

          if (report) {
            // Add the report submitter
            userIds.push(report.submittedBy);

            // Add direct branch managers
            const directManagers = await getBranchManagers(report.branchId);
            userIds.push(...directManagers);

            // Find the submitter's supervisor (if any)
            const submitter = await prisma.user.findUnique({
              where: { id: report.submittedBy },
              include: {
                userRoles: {
                  include: {
                    role: true,
                    branch: true
                  }
                }
              }
            });

            if (submitter) {
              // Look for users with supervisor roles for this user's branch
              const supervisors = await prisma.user.findMany({
                where: {
                  userRoles: {
                    some: {
                      role: {
                        name: {
                          in: ['SUPERVISOR', 'supervisor']
                        }
                      },
                      branchId: submitter.branchId
                    }
                  },
                  isActive: true
                },
                select: { id: true }
              });

              userIds.push(...supervisors.map(user => user.id));
            }
          }
        }
        break;
      }

      case NotificationType.APPROVAL_PENDING: {
        // Notify users with approval permissions for this branch and parent branches
        // 1. Direct branch approvers
        const directApprovers = await prisma.user.findMany({
          where: {
            userRoles: {
              some: {
                role: {
                  name: {
                    in: ['admin', 'approver', 'manager', 'ADMIN', 'BRANCH_MANAGER']
                  }
                },
                branchId
              }
            },
            isActive: true
          },
          select: { id: true }
        });

        userIds.push(...directApprovers.map(user => user.id));

        // 2. Parent branch approvers
        const parentBranches = await getBranchHierarchy(branchId);
        for (const parentId of parentBranches) {
          if (parentId !== branchId) {
            const parentApprovers = await prisma.user.findMany({
              where: {
                userRoles: {
                  some: {
                    role: {
                      name: {
                        in: ['admin', 'approver', 'manager', 'ADMIN', 'BRANCH_MANAGER']
                      }
                    },
                    branchId: parentId
                  }
                },
                isActive: true
              },
              select: { id: true }
            });

            userIds.push(...parentApprovers.map(user => user.id));
          }
        }
        break;
      }

      case NotificationType.REPORT_REMINDER:
      case NotificationType.REPORT_OVERDUE: {
        // For reminders/overdue notices, notify branch users who should submit reports
        // and their direct supervisors/managers
        const branchUsers = await prisma.user.findMany({
          where: {
            OR: [
              { branchId },
              {
                branchAssignments: {
                  some: { branchId }
                }
              }
            ],
            userRoles: {
              some: {
                role: {
                  name: {
                    in: ['reporter', 'user', 'manager', 'USER', 'SUPERVISOR', 'BRANCH_MANAGER']
                  }
                }
              }
            },
            isActive: true
          },
          select: { id: true }
        });

        userIds.push(...branchUsers.map(user => user.id));

        // Add direct branch managers if not already included
        const directManagers = await getBranchManagers(branchId);
        userIds.push(...directManagers);
        break;
      }

      case NotificationType.COMMENT_ADDED: {
        // For comments, notify users involved with the report
        if (data.reportId) {
          const report = await prisma.report.findUnique({
            where: { id: data.reportId },
            select: { submittedBy: true, branchId: true }
          });

          if (report) {
            // 1. Add report submitter
            userIds.push(report.submittedBy);

            // 2. Add branch managers
            const directManagers = await getBranchManagers(report.branchId);
            userIds.push(...directManagers);

            // 3. Add users involved in prior comments (if tracked)
            if (data.commenters && Array.isArray(data.commenters)) {
              userIds.push(...data.commenters);
            }

            // Skip the commenter (don't notify the person who made the comment)
            if (data.commenter) {
              userIds = userIds.filter(id => id !== data.commenter);
            }
          }
        }
        break;
      }

      case NotificationType.SYSTEM_NOTIFICATION: {
        // System notifications can target users by roles or all users
        if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
          const usersWithRoles = await prisma.user.findMany({
            where: {
              OR: [
                {
                  role: {
                    in: data.roles
                  }
                },
                {
                  userRoles: {
                    some: {
                      role: {
                        name: {
                          in: data.roles
                        }
                      }
                    }
                  }
                }
              ],
              isActive: true
            },
            select: { id: true }
          });

          userIds.push(...usersWithRoles.map(user => user.id));
        } else if (data.allUsers) {
          // Send to all active users
          const allUsers = await prisma.user.findMany({
            where: {
              isActive: true
            },
            select: { id: true }
          });

          userIds.push(...allUsers.map(user => user.id));
        } else if (data.branchId) {
          // If branch hierarchy targeting is specified
          if (data.includeSubBranches) {
            // Include users from sub-branches
            const subBranches = await getSubBranches(data.branchId);
            const allBranchIds = [data.branchId, ...subBranches];

            const branchUsers = await prisma.user.findMany({
              where: {
                OR: [
                  {
                    branchId: {
                      in: allBranchIds
                    }
                  },
                  {
                    branchAssignments: {
                      some: {
                        branchId: {
                          in: allBranchIds
                        }
                      }
                    }
                  }
                ],
                isActive: true
              },
              select: { id: true }
            });

            userIds.push(...branchUsers.map(user => user.id));
          } else if (data.includeParentBranches) {
            // Include users from parent branches
            const parentBranches = await getBranchHierarchy(data.branchId);

            const branchUsers = await prisma.user.findMany({
              where: {
                OR: [
                  {
                    branchId: {
                      in: parentBranches
                    }
                  },
                  {
                    branchAssignments: {
                      some: {
                        branchId: {
                          in: parentBranches
                        }
                      }
                    }
                  }
                ],
                isActive: true
              },
              select: { id: true }
            });

            userIds.push(...branchUsers.map(user => user.id));
          } else {
            // Just this specific branch
            const branchUsers = await prisma.user.findMany({
              where: {
                OR: [
                  { branchId: data.branchId },
                  {
                    branchAssignments: {
                      some: { branchId: data.branchId }
                    }
                  }
                ],
                isActive: true
              },
              select: { id: true }
            });

            userIds.push(...branchUsers.map(user => user.id));
          }
        }
        break;
      }

      default:
        //console.log(`Unhandled notification type: ${type}`);
        break;
    }
  } catch (error) {
    console.error(`Error getting users for notification type ${type}:`, error);
    // Return current user IDs even on error, to ensure at least some notifications are sent
  }

  // Remove duplicates and return
  return [...new Set(userIds)];
}