import { prisma } from '@/lib/prisma';
/**
 * Get user IDs that should receive a specific notification
 */
export async function getUsersForNotification(type, data) {
    // Default to empty array
    let userIds = [];
    // If a submitter is provided, always include them in target users
    if (data.id || data.userId || data.submittedBy) {
        const submitterId = data.id || data.userId || data.submittedBy;
        if (submitterId && !userIds.includes(submitterId)) {
            userIds.push(submitterId);
        }
    }
    switch (type) {
        case 'REPORT_SUBMITTED':
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
                        ]
                    },
                    select: { id: true }
                });
                userIds = [...userIds, ...branchManagers.map(user => user.id)];
            }
            break;
        case 'REPORT_APPROVED':
        case 'REPORT_REJECTED':
        case 'REPORT_NEEDS_REVISION':
            // Get the report submitter
            if (data.reportId) {
                const report = await prisma.report.findUnique({
                    where: { id: data.reportId },
                    select: { submittedBy: true, branchId: true }
                });
                if (report) {
                    // Add the report submitter
                    userIds.push(report.submittedBy);
                    // Add branch managers except for approvals (they already know)
                    if (type !== 'REPORT_APPROVED') {
                        const branchManagers = await prisma.user.findMany({
                            where: {
                                userRoles: {
                                    some: {
                                        role: {
                                            name: 'manager'
                                        },
                                        branchId: report.branchId
                                    }
                                }
                            },
                            select: { id: true }
                        });
                        userIds = [...userIds, ...branchManagers.map(user => user.id)];
                    }
                }
            }
            break;
        case 'APPROVAL_PENDING':
            // Send to users with approval permissions
            const approvers = await prisma.user.findMany({
                where: {
                    userRoles: {
                        some: {
                            role: {
                                name: {
                                    in: ['approver', 'admin']
                                }
                            }
                        }
                    }
                },
                select: { id: true }
            });
            userIds = [...userIds, ...approvers.map(user => user.id)];
            break;
        case 'COMMENT_ADDED':
            if (data.reportId) {
                // Get all users involved with this report
                const report = await prisma.report.findUnique({
                    where: { id: data.reportId },
                    select: { submittedBy: true, branchId: true }
                });
                if (report) {
                    // Get the report submitter and branch managers
                    userIds.push(report.submittedBy);
                    const branchUsers = await prisma.user.findMany({
                        where: {
                            OR: [
                                { branchId: report.branchId },
                                {
                                    userRoles: {
                                        some: {
                                            branchId: report.branchId
                                        }
                                    }
                                }
                            ]
                        },
                        select: { id: true }
                    });
                    userIds = [...userIds, ...branchUsers.map(user => user.id)];
                    // Don't notify the commenter
                    if (data.commenterId) {
                        userIds = userIds.filter(id => id !== data.commenterId);
                    }
                }
            }
            break;
        default:
            break;
    }
    // Remove duplicates
    return [...new Set(userIds)];
}
