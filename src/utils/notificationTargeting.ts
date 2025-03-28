import { prisma } from '@/lib/prisma';
import { NotificationType } from './notificationTemplates';
import { getAccessibleBranches } from '@/lib/auth/branch-access';

/**
 * Get user IDs that should receive a specific notification
 * Returns an array of user IDs who should receive the notification
 */
export async function getUsersForNotification(
  type: NotificationType,
  data: Record<string, any>
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
    switch (type) {
      case NotificationType.REPORT_SUBMITTED:
        // Send to managers and approvers for the branch
        // Extract branchId directly or from the branch object if provided
        const branchId = data.branchId || (data.branch?.id || null);
        
        if (branchId) {
          // Get branch managers and users with approval role
          const branchManagers = await prisma.user.findMany({
            where: {
              OR: [
                {
                  userRoles: {
                    some: {
                      role: {
                        name: {
                          in: ['manager', 'admin', 'approver']
                        }
                      },
                      branchId: branchId
                    }
                  }
                },
                {
                  userRoles: {
                    some: {
                      role: {
                        name: 'admin'
                      },
                      branchId: null // Global admins
                    }
                  }
                }
              ],
              isActive: true // Only active users
            },
            select: { id: true }
          });
          
          userIds = [...userIds, ...branchManagers.map(user => user.id)];
        }
        break;

      case NotificationType.REPORT_APPROVED:
      case NotificationType.REPORT_REJECTED:
        // Get the report submitter
        if (data.reportId) {
          const report = await prisma.report.findUnique({
            where: { id: data.reportId },
            select: { submittedBy: true, branchId: true }
          });

          if (report) {
            // Add the report submitter
            userIds.push(report.submittedBy);

            // For rejections, also notify branch managers
            if (type === NotificationType.REPORT_REJECTED) {
              // Get all users who have access to this branch
              const branchUsers = await prisma.user.findMany({
                where: {
                  userRoles: {
                    some: {
                      role: {
                        name: 'manager'
                      },
                      branchId: report.branchId
                    }
                  },
                  isActive: true
                },
                select: { id: true }
              });
              
              userIds = [...userIds, ...branchUsers.map(user => user.id)];
            }
          }
        }
        break;

      case NotificationType.REPORT_REMINDER:
        // For due date reminders, get users who should submit reports for specified date
        if (data.date && data.branchId) {
          // Get all users who have access to this branch
          const branchUsers = await prisma.user.findMany({
            where: {
              OR: [
                { branchId: data.branchId },
                {
                  branchAssignments: {
                    some: {
                      branchId: data.branchId
                    }
                  }
                }
              ],
              userRoles: {
                some: {
                  role: {
                    name: {
                      in: ['reporter', 'manager', 'user']
                    }
                  }
                }
              },
              isActive: true
            },
            select: { id: true }
          });
          
          userIds = [...userIds, ...branchUsers.map(user => user.id)];
        }
        break;

      case NotificationType.REPORT_OVERDUE:
        // Get branch managers and the report owner
        if (data.branchId) {
          // Get all users who have access to this branch
          const branchUsers = await prisma.user.findMany({
            where: {
              userRoles: {
                some: {
                  role: {
                    name: {
                      in: ['manager', 'admin']
                    }
                  },
                  branchId: data.branchId
                }
              },
              isActive: true
            },
            select: { id: true }
          });
          
          userIds = [...userIds, ...branchUsers.map(user => user.id)];
        }
        
        // Also include the specific user responsible if known
        if (data.userId) {
          userIds.push(data.userId);
        }
        break;

      case NotificationType.SYSTEM_NOTIFICATION:
        // System notifications can be sent to all users or specific roles
        if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
          const usersWithRoles = await prisma.user.findMany({
            where: {
              userRoles: {
                some: {
                  role: {
                    name: {
                      in: data.roles
                    }
                  }
                }
              },
              isActive: true
            },
            select: { id: true }
          });
          
          userIds = [...userIds, ...usersWithRoles.map(user => user.id)];
        } else if (data.allUsers) {
          // Send to all active users
          const allUsers = await prisma.user.findMany({
            where: {
              isActive: true
            },
            select: { id: true }
          });
          
          userIds = [...userIds, ...allUsers.map(user => user.id)];
        }
        break;

      default:
        console.log(`Unhandled notification type: ${type}`);
        break;
    }
  } catch (error) {
    console.error(`Error getting users for notification type ${type}:`, error);
    // Return empty array on error, or could throw based on your error handling preference
  }

  // Remove duplicates
  return [...new Set(userIds)];
} 