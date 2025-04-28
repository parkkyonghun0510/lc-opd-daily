/**
 * Report Comment Notification Service
 *
 * This service handles sending push notifications for report comments,
 * including approvals, rejections, and regular comments.
 */

import { ReportCommentType } from '@/types/reports';
import { sendNotification } from '@/lib/redis/enhancedRedisNotificationService';
import { prisma } from '@/lib/prisma';
import { rateLimiter } from '@/lib/rate-limit';

// Comment notification types
export enum CommentNotificationType {
  COMMENT_ADDED = 'COMMENT_ADDED',
  REPORT_APPROVED = 'REPORT_APPROVED',
  REPORT_REJECTED = 'REPORT_REJECTED',
}

/**
 * Process a new comment and send appropriate notifications
 *
 * @param comment - The newly created comment
 * @param reportId - The ID of the report
 * @returns The notification ID if sent, null otherwise
 */
export async function processCommentNotification(
  comment: ReportCommentType,
  reportId: string
): Promise<string | null> {
  try {
    // Skip if no comment content
    if (!comment.content) return null;

    // Determine notification type based on comment content
    let notificationType: CommentNotificationType;
    const lowerContent = comment.content.toLowerCase();

    if (
      lowerContent.includes('report approved') ||
      lowerContent.includes('approved the report') ||
      lowerContent.startsWith('approved:') ||
      lowerContent.startsWith('approved') ||
      lowerContent.includes('report has been approved')
    ) {
      notificationType = CommentNotificationType.REPORT_APPROVED;
    } else if (
      lowerContent.includes('report rejected') ||
      lowerContent.includes('rejected the report') ||
      lowerContent.startsWith('rejected:') ||
      lowerContent.startsWith('rejected') ||
      lowerContent.includes('report has been rejected')
    ) {
      notificationType = CommentNotificationType.REPORT_REJECTED;
    } else {
      notificationType = CommentNotificationType.COMMENT_ADDED;
    }

    // Get the report with branch and user info
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        branch: true,
      },
    });

    if (!report) return null;

    // Determine target users for the notification
    const targetUserIds = await getTargetUsersForComment(comment, report);
    if (targetUserIds.length === 0) return null;

    // Apply rate limiting for notifications
    const isRateLimited = await checkNotificationRateLimit(comment.userId);
    if (isRateLimited) {
      console.warn(`Rate limit exceeded for comment notifications from user ${comment.userId}`);
      return null;
    }

    // Create notification data
    const notificationData = {
      reportId,
      branchName: report.branch?.name || 'Unknown Branch',
      branchId: report.branchId,
      date: report.date,
      commentId: comment.id,
      commentContent: comment.content,
      commentType: notificationType,
      reportType: report.reportType,
      submittedBy: 'Unknown User', // We don't have user relation in Report model
      commenterName: comment.user?.name || 'Unknown User',
      title: getNotificationTitle(notificationType, report.branch?.name),
      body: getNotificationBody(notificationType, comment.content, comment.user?.name),
      actionUrl: `/dashboard?viewReport=${reportId}&action=reply`,
    };

    // Send notification using Redis service
    const notificationId = await sendNotification({
      type: mapToSystemNotificationType(notificationType),
      data: notificationData,
      userIds: targetUserIds,
      priority: getPriorityForNotificationType(notificationType),
    });

    return notificationId;
  } catch (error) {
    console.error('Error processing comment notification:', error);
    return null;
  }
}

/**
 * Get target users for a comment notification
 *
 * @param comment - The comment
 * @param report - The report with user info
 * @returns Array of user IDs to notify
 */
async function getTargetUsersForComment(
  comment: ReportCommentType,
  report: any
): Promise<string[]> {
  const targetUserIds = new Set<string>();

  // Always notify the report creator (unless they made the comment)
  if (report.userId && report.userId !== comment.userId) {
    targetUserIds.add(report.userId);
  }

  // Get all users who have commented on this report
  const commenters = await prisma.reportComment.findMany({
    where: {
      reportId: report.id,
      userId: {
        not: comment.userId, // Don't notify the commenter
      },
    },
    select: {
      userId: true,
    },
    distinct: ['userId'],
  });

  // Add all commenters to target users
  commenters.forEach(commenter => {
    if (commenter.userId) {
      targetUserIds.add(commenter.userId);
    }
  });

  // For approvals/rejections, also notify branch managers
  const lowerContent = comment.content.toLowerCase();
  if (
    lowerContent.includes('approved') ||
    lowerContent.includes('rejected')
  ) {
    // Get branch managers for this branch
    const branchManagers = await prisma.userBranchAssignment.findMany({
      where: {
        branchId: report.branchId,
        user: {
          userRoles: {
            some: {
              role: {
                name: 'BRANCH_MANAGER',
              },
            },
          },
        },
      },
      select: {
        userId: true,
      },
    });

    // Add branch managers to target users
    branchManagers.forEach(manager => {
      if (manager.userId && manager.userId !== comment.userId) {
        targetUserIds.add(manager.userId);
      }
    });
  }

  return Array.from(targetUserIds);
}

/**
 * Check if notifications from this user are rate limited
 *
 * @param userId - The user ID
 * @returns Whether the user is rate limited
 */
async function checkNotificationRateLimit(userId: string): Promise<boolean> {
  // Create a key for the rate limit
  const key = `comment-notifications:${userId}`;

  // Use Redis to check/set rate limit
  try {
    const count = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "ReportComment"
      WHERE "userId" = ${userId}
      AND "createdAt" > NOW() - INTERVAL '1 minute'
    `;

    // Rate limit: 5 comment notifications per minute per user
    return (count as any)[0].count >= 5;
  } catch (error) {
    console.error('Error checking notification rate limit:', error);
    return false; // On error, allow the notification
  }
}

/**
 * Get notification title based on type
 */
function getNotificationTitle(
  type: CommentNotificationType,
  branchName?: string
): string {
  switch (type) {
    case CommentNotificationType.REPORT_APPROVED:
      return `Report Approved - ${branchName || 'Branch'}`;
    case CommentNotificationType.REPORT_REJECTED:
      return `Report Rejected - ${branchName || 'Branch'}`;
    case CommentNotificationType.COMMENT_ADDED:
      return `New Comment - ${branchName || 'Branch'} Report`;
    default:
      return 'Report Update';
  }
}

/**
 * Get notification body based on type
 */
function getNotificationBody(
  type: CommentNotificationType,
  content: string,
  userName?: string
): string {
  const user = userName || 'Someone';

  switch (type) {
    case CommentNotificationType.REPORT_APPROVED:
      return `${user} approved the report: "${truncateContent(content)}"`;
    case CommentNotificationType.REPORT_REJECTED:
      return `${user} rejected the report: "${truncateContent(content)}"`;
    case CommentNotificationType.COMMENT_ADDED:
      return `${user} commented: "${truncateContent(content)}"`;
    default:
      return truncateContent(content);
  }
}

/**
 * Truncate content to a reasonable length for notifications
 */
function truncateContent(content: string, maxLength = 100): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength - 3) + '...';
}

/**
 * Map comment notification type to system notification type
 */
function mapToSystemNotificationType(type: CommentNotificationType): string {
  switch (type) {
    case CommentNotificationType.REPORT_APPROVED:
      return 'REPORT_APPROVED';
    case CommentNotificationType.REPORT_REJECTED:
      return 'REPORT_REJECTED';
    case CommentNotificationType.COMMENT_ADDED:
      return 'REPORT_COMMENT';
    default:
      return 'SYSTEM_NOTIFICATION';
  }
}

/**
 * Get priority for notification type
 */
function getPriorityForNotificationType(type: CommentNotificationType): 'high' | 'normal' | 'low' {
  switch (type) {
    case CommentNotificationType.REPORT_APPROVED:
    case CommentNotificationType.REPORT_REJECTED:
      return 'high';
    case CommentNotificationType.COMMENT_ADDED:
      return 'normal';
    default:
      return 'normal';
  }
}
