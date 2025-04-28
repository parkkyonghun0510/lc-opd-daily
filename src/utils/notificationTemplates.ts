export enum NotificationType {
  REPORT_SUBMITTED = 'REPORT_SUBMITTED',
  REPORT_APPROVED = 'REPORT_APPROVED',
  REPORT_REJECTED = 'REPORT_REJECTED',
  REPORT_REMINDER = 'REPORT_REMINDER',
  REPORT_OVERDUE = 'REPORT_OVERDUE',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION',
  REPORT_NEEDS_REVISION = 'REPORT_NEEDS_REVISION',
  APPROVAL_PENDING = 'APPROVAL_PENDING',
  COMMENT_ADDED = 'COMMENT_ADDED',
  COMMENT_REPLY = 'COMMENT_REPLY'
}

interface NotificationContent {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  data?: Record<string, any>;
}

/**
 * Generate notification content based on type and data
 */
export function generateNotificationContent(
  type: NotificationType,
  data: Record<string, any> = {}
): NotificationContent {
  // Default notification content
  const defaultContent: NotificationContent = {
    title: 'Notification',
    body: 'You have a new notification',
    icon: '/icons/default.png',
    url: '/',
    data: {}
  };

  // Override with provided data
  if (data.title) defaultContent.title = data.title;
  if (data.body) defaultContent.body = data.body;
  if (data.icon) defaultContent.icon = data.icon;
  if (data.url) defaultContent.url = data.url;

  // Type-specific content
  switch (type) {
    case NotificationType.REPORT_SUBMITTED:
      if (!data.title) defaultContent.title = 'New Report Submitted';
      if (!data.body) defaultContent.body = `A new report has been submitted by ${data.submitterName || 'a user'} and requires review.`;
      if (!data.url) defaultContent.url = data.reportId ? `/dashboard?viewReport=${data.reportId}` : '/dashboard';
      defaultContent.icon = '/icons/report-submitted.png';
      break;

    case NotificationType.REPORT_APPROVED:
      if (!data.title) defaultContent.title = 'Report Approved';
      if (!data.body) defaultContent.body = `Your report has been approved by ${data.approverName || 'a manager'}.`;
      if (!data.url) defaultContent.url = data.reportId ? `/dashboard?viewReport=${data.reportId}` : '/dashboard';
      defaultContent.icon = '/icons/report-approved.png';
      break;

    case NotificationType.REPORT_REJECTED:
      if (!data.title) defaultContent.title = 'Report Rejected';
      if (!data.body) defaultContent.body = `Your report has been rejected by ${data.approverName || 'a manager'}.`;
      if (!data.url) defaultContent.url = data.reportId ? `/dashboard?viewReport=${data.reportId}` : '/dashboard';
      defaultContent.icon = '/icons/report-rejected.png';
      break;

    case NotificationType.REPORT_REMINDER:
      if (!data.title) defaultContent.title = 'Report Reminder';
      if (!data.body) defaultContent.body = `You have reports due for ${data.date || 'today'}.`;
      if (!data.url) defaultContent.url = '/dashboard?tab=create';
      defaultContent.icon = '/icons/report-reminder.png';
      break;

    case NotificationType.REPORT_OVERDUE:
      if (!data.title) defaultContent.title = 'Report Overdue';
      if (!data.body) defaultContent.body = `Your report for ${data.date || 'a recent date'} is now overdue.`;
      if (!data.url) defaultContent.url = '/dashboard?tab=create';
      defaultContent.icon = '/icons/report-overdue.png';
      break;

    case NotificationType.SYSTEM_NOTIFICATION:
      if (!data.title) defaultContent.title = 'System Notification';
      if (!data.url) defaultContent.url = '/dashboard';
      defaultContent.icon = '/icons/system-notification.png';
      break;

    case NotificationType.REPORT_NEEDS_REVISION:
      if (!data.title) defaultContent.title = 'Report Needs Revision';
      if (!data.body) defaultContent.body = `Your report requires some revisions before it can be approved.`;
      if (!data.url) defaultContent.url = data.reportId ? `/dashboard?viewReport=${data.reportId}&action=edit` : '/dashboard';
      defaultContent.icon = '/icons/report-rejected.png';
      break;

    case NotificationType.APPROVAL_PENDING:
      if (!data.title) defaultContent.title = 'Reports Pending Approval';
      if (!data.body) defaultContent.body = `There are ${data.count || 'several'} reports waiting for your approval.`;
      if (!data.url) defaultContent.url = '/dashboard?tab=approvals';
      defaultContent.icon = '/icons/report-submitted.png';
      break;

    case NotificationType.COMMENT_ADDED:
      if (!data.title) defaultContent.title = 'New Comment';
      if (!data.body) defaultContent.body = `${data.commenter || 'Someone'} commented on a report.`;
      if (!data.url) defaultContent.url = data.reportId ? `/dashboard?viewReport=${data.reportId}&action=reply` : '/dashboard';
      defaultContent.icon = '/icons/comment.png';
      break;

    case NotificationType.COMMENT_REPLY:
      if (!data.title) defaultContent.title = 'New Reply to Your Comment';
      if (!data.body) {
        const reportInfo = data.branchName && data.reportDate
          ? ` on the ${data.branchName} report (${data.reportDate})`
          : '';
        defaultContent.body = `${data.commenterName || 'Someone'} replied to your comment${reportInfo}: "${data.commentText || '...'}"`;
      }
      if (!data.url) defaultContent.url = data.reportId ? `/dashboard?viewReport=${data.reportId}&action=reply` : '/dashboard';
      defaultContent.icon = '/icons/comment.png';
      break;
  }

  return defaultContent;
}