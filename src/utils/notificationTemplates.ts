export enum NotificationType {
  REPORT_SUBMITTED = 'REPORT_SUBMITTED',
  REPORT_APPROVED = 'REPORT_APPROVED',
  REPORT_REJECTED = 'REPORT_REJECTED',
  REPORT_REMINDER = 'REPORT_REMINDER',
  REPORT_OVERDUE = 'REPORT_OVERDUE',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION'
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
      if (!data.url) defaultContent.url = `/reports/${data.reportId || ''}`;
      defaultContent.icon = '/icons/report-submitted.png';
      break;

    case NotificationType.REPORT_APPROVED:
      if (!data.title) defaultContent.title = 'Report Approved';
      if (!data.body) defaultContent.body = `Your report has been approved by ${data.approverName || 'a manager'}.`;
      if (!data.url) defaultContent.url = `/reports/${data.reportId || ''}`;
      defaultContent.icon = '/icons/report-approved.png';
      break;

    case NotificationType.REPORT_REJECTED:
      if (!data.title) defaultContent.title = 'Report Rejected';
      if (!data.body) defaultContent.body = `Your report has been rejected by ${data.approverName || 'a manager'}.`;
      if (!data.url) defaultContent.url = `/reports/${data.reportId || ''}`;
      defaultContent.icon = '/icons/report-rejected.png';
      break;

    case NotificationType.REPORT_REMINDER:
      if (!data.title) defaultContent.title = 'Report Reminder';
      if (!data.body) defaultContent.body = `You have reports due for ${data.date || 'today'}.`;
      if (!data.url) defaultContent.url = '/reports/create';
      defaultContent.icon = '/icons/report-reminder.png';
      break;

    case NotificationType.REPORT_OVERDUE:
      if (!data.title) defaultContent.title = 'Report Overdue';
      if (!data.body) defaultContent.body = `Your report for ${data.date || 'a recent date'} is now overdue.`;
      if (!data.url) defaultContent.url = '/reports/create';
      defaultContent.icon = '/icons/report-overdue.png';
      break;

    case NotificationType.SYSTEM_NOTIFICATION:
      if (!data.title) defaultContent.title = 'System Notification';
      if (!data.url) defaultContent.url = '/dashboard';
      defaultContent.icon = '/icons/system-notification.png';
      break;
  }

  return defaultContent;
} 