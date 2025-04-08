/**
 * Helper functions for notification operations
 * These functions provide reusable logic for common notification-related operations
 */

import { prisma } from '@/lib/prisma';
import { NotificationType } from './notificationTemplates';
import { getUsersForNotification } from './notificationTargeting';
import { sendToNotificationQueue } from '@/lib/queue/sqs';
import { createDirectNotifications } from './createDirectNotification';

/**
 * Interface for notification data
 */
export interface NotificationData {
    reportId?: string;
    branchId?: string;
    branchName?: string;
    submitterId?: string;
    submitterName?: string;
    approverName?: string;
    comments?: string;
    title?: string;
    body?: string;
    actionUrl?: string;
    [key: string]: any;
}

/**
 * Send a notification to users based on notification type and data
 * Handles queue sending with fallback to direct notifications
 * 
 * @param type The type of notification to send
 * @param data The data for the notification
 * @param fallbackTitle Optional fallback title if queue fails
 * @param fallbackBody Optional fallback body if queue fails
 * @param fallbackUrl Optional fallback action URL if queue fails
 * @returns Object containing success status and count of notifications sent
 */
export async function sendNotification(
    type: NotificationType,
    data: NotificationData,
    fallbackTitle?: string,
    fallbackBody?: string,
    fallbackUrl?: string
): Promise<{ success: boolean; count: number }> {
    try {
        // Get target users for this notification
        const targetUsers = await getUsersForNotification(type, data);

        if (!targetUsers || targetUsers.length === 0) {
            console.log(`No target users found for notification type ${type}`);
            return { success: true, count: 0 };
        }

        console.log(`Found ${targetUsers.length} target users for notification type ${type}`);

        // Prepare queue data
        const queueData = {
            type,
            data,
            userIds: targetUsers
        };

        try {
            // Try sending to queue first
            const result = await sendToNotificationQueue(queueData);
            console.log(`Notification sent to queue successfully:`, result);
            return { success: true, count: targetUsers.length };
        } catch (queueError) {
            console.error("Error sending to notification queue, using fallback:", queueError);

            // Fall back to direct notifications if queue fails
            if (fallbackTitle && fallbackBody) {
                const actionUrl = fallbackUrl || (data.reportId ? `/reports/${data.reportId}` : '/dashboard');

                const result = await createDirectNotifications(
                    type,
                    fallbackTitle,
                    fallbackBody,
                    targetUsers,
                    actionUrl,
                    {
                        ...data,
                        method: "fallback-direct"
                    }
                );

                return { success: true, count: result.count };
            }

            // If no fallback provided, re-throw the error
            throw queueError;
        }
    } catch (error) {
        console.error(`Error sending notification of type ${type}:`, error);
        return { success: false, count: 0 };
    }
}

/**
 * Send a report status change notification
 * 
 * @param reportId The ID of the report
 * @param status The new status of the report ('approved' or 'rejected')
 * @param approverName The name of the user who approved/rejected the report
 * @param comments Optional comments about the status change
 * @returns Object containing success status and count of notifications sent
 */
export async function sendReportStatusNotification(
    reportId: string,
    status: 'approved' | 'rejected',
    approverName: string,
    comments?: string
): Promise<{ success: boolean; count: number }> {
    try {
        // Get report details
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            select: {
                branchId: true,
                branch: { select: { name: true } }
            }
        });

        if (!report) {
            console.error(`Report not found: ${reportId}`);
            return { success: false, count: 0 };
        }

        const notificationType = status === 'approved'
            ? NotificationType.REPORT_APPROVED
            : NotificationType.REPORT_REJECTED;

        const title = status === 'approved' ? 'Report Approved' : 'Report Rejected';
        const body = status === 'approved'
            ? `Your report has been approved by ${approverName}.`
            : `Your report has been rejected${comments ? ` with reason: ${comments}` : ''}.`;

        const notificationData: NotificationData = {
            reportId,
            branchId: report.branchId,
            branchName: report.branch.name,
            approverName,
            comments: comments || ''
        };

        return sendNotification(
            notificationType,
            notificationData,
            title,
            body,
            `/reports/${reportId}`
        );
    } catch (error) {
        console.error(`Error sending report status notification:`, error);
        return { success: false, count: 0 };
    }
}

/**
 * Send a report submission notification
 * 
 * @param reportId The ID of the submitted report
 * @param submitterName The name of the user who submitted the report
 * @returns Object containing success status and count of notifications sent
 */
export async function sendReportSubmittedNotification(
    reportId: string,
    submitterName: string
): Promise<{ success: boolean; count: number }> {
    try {
        // Get report details
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            select: {
                branchId: true,
                branch: { select: { name: true } },
                reportType: true,
                date: true
            }
        });

        if (!report) {
            console.error(`Report not found: ${reportId}`);
            return { success: false, count: 0 };
        }

        const title = 'New Report Submitted';
        const body = `${submitterName} has submitted a new ${report.reportType} report for ${report.branch.name}.`;

        const notificationData: NotificationData = {
            reportId,
            branchId: report.branchId,
            branchName: report.branch.name,
            submitterName,
            reportType: report.reportType,
            reportDate: report.date
        };

        return sendNotification(
            NotificationType.REPORT_SUBMITTED,
            notificationData,
            title,
            body,
            `/reports/${reportId}`
        );
    } catch (error) {
        console.error(`Error sending report submitted notification:`, error);
        return { success: false, count: 0 };
    }
}

/**
 * Send a comment notification
 * 
 * @param reportId The ID of the report that was commented on
 * @param commenterName The name of the user who made the comment
 * @param commentText The text of the comment
 * @returns Object containing success status and count of notifications sent
 */
export async function sendCommentNotification(
    reportId: string,
    commenterName: string,
    commentText: string
): Promise<{ success: boolean; count: number }> {
    try {
        // Get report details
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            select: {
                branchId: true,
                branch: { select: { name: true } },
                submittedBy: true
            }
        });

        if (!report) {
            console.error(`Report not found: ${reportId}`);
            return { success: false, count: 0 };
        }

        // Since there's no reportComment model in the schema,
        // we'll just notify the report submitter and branch managers
        // We could add a commenters array to the function parameters if needed
        const commenterIds: string[] = [];

        const title = 'New Comment on Report';
        const body = `${commenterName} commented on a report: "${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}"`;

        const notificationData: NotificationData = {
            reportId,
            branchId: report.branchId,
            branchName: report.branch.name,
            submittedBy: report.submittedBy,
            commenter: commenterName,
            commenters: commenterIds,
            commentText
        };

        return sendNotification(
            NotificationType.COMMENT_ADDED,
            notificationData,
            title,
            body,
            `/reports/${reportId}#comments`
        );
    } catch (error) {
        console.error(`Error sending comment notification:`, error);
        return { success: false, count: 0 };
    }
}

/**
 * Send a system notification to users
 * 
 * @param title The notification title
 * @param body The notification body
 * @param targetRoles Optional array of role names to target
 * @param targetBranchId Optional branch ID to target
 * @param includeSubBranches Whether to include sub-branches of the target branch
 * @param actionUrl Optional URL to navigate to when the notification is clicked
 * @returns Object containing success status and count of notifications sent
 */
export async function sendSystemNotification(
    title: string,
    body: string,
    targetRoles?: string[],
    targetBranchId?: string,
    includeSubBranches: boolean = false,
    actionUrl: string = '/dashboard'
): Promise<{ success: boolean; count: number }> {
    try {
        const notificationData: NotificationData = {
            title,
            body,
            actionUrl,
            roles: targetRoles,
            branchId: targetBranchId,
            includeSubBranches,
            allUsers: !targetRoles && !targetBranchId
        };

        return sendNotification(
            NotificationType.SYSTEM_NOTIFICATION,
            notificationData,
            title,
            body,
            actionUrl
        );
    } catch (error) {
        console.error(`Error sending system notification:`, error);
        return { success: false, count: 0 };
    }
}
