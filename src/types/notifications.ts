/**
 * Notification event types that can be shared between client and server
 */
export enum NotificationEventType {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  CLICKED = 'CLICKED',
  CLOSED = 'CLOSED'
}

/**
 * Notification status types
 */
export type NotificationStatus = 'read' | 'unread' | 'all';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'high' | 'normal' | 'low';

/**
 * Basic notification structure for client use
 */
export interface NotificationBase {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string | null;
} 