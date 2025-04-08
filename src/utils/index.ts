/**
 * Utils module exports
 * This file exports all utility functions and constants from a single entry point
 */

// Export from notificationTemplates.ts
export { NotificationType } from './notificationTemplates';

// Export from notificationTargeting.ts
export { getUsersForNotification } from './notificationTargeting';

// Export from notificationHelpers.ts
export type { NotificationData } from './notificationHelpers';
export {
    sendNotification,
    sendReportStatusNotification,
    sendReportSubmittedNotification,
    sendCommentNotification,
    sendSystemNotification
} from './notificationHelpers';

// Export from createDirectNotification.ts
export { createDirectNotifications } from './createDirectNotification';
