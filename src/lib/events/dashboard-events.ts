/**
 * Dashboard Event Types
 * 
 * This file defines all possible event types that can trigger dashboard updates.
 * Events are grouped by domain for better organization and maintenance.
 */

export const DashboardEventTypes = {
    // Report Core Events
    REPORT_CREATED: 'REPORT_CREATED',           // When a new report is created
    REPORT_UPDATED: 'REPORT_UPDATED',           // General report updates (status, edits)
    REPORT_DELETED: 'REPORT_DELETED',           // When a report is deleted

    // Report Attribute Events
    REPORT_STATUS_UPDATED: 'REPORT_STATUS_UPDATED',       // Status changes
    REPORT_PRIORITY_UPDATED: 'REPORT_PRIORITY_UPDATED',   // Priority changes
    REPORT_CATEGORY_UPDATED: 'REPORT_CATEGORY_UPDATED',   // Category changes
    REPORT_DUE_DATE_UPDATED: 'REPORT_DUE_DATE_UPDATED',  // Due date changes
    REPORT_ASSIGNMENT_UPDATED: 'REPORT_ASSIGNMENT_UPDATED', // Assignment changes

    // Report Content Events
    REPORT_TAG_UPDATED: 'REPORT_TAG_UPDATED',           // Tag added/removed/updated
    REPORT_COMMENT_UPDATED: 'REPORT_COMMENT_UPDATED',   // Comment added/removed/updated
    REPORT_ATTACHMENT_UPDATED: 'REPORT_ATTACHMENT_UPDATED', // Attachment added/removed/updated

    // Resolution Events
    REPORT_RESOLUTION_UPDATED: 'REPORT_RESOLUTION_UPDATED',           // Resolution added/removed/updated
    REPORT_RESOLUTION_STATUS_UPDATED: 'REPORT_RESOLUTION_STATUS_UPDATED', // Resolution status changes
    REPORT_RESOLUTION_CONTENT_UPDATED: 'REPORT_RESOLUTION_CONTENT_UPDATED', // Resolution content changes

    // User Events
    USER_CREATED: 'USER_CREATED',               // New user created
    USER_UPDATED: 'USER_UPDATED',               // User profile/details updated
    USER_DELETED: 'USER_DELETED',               // User deleted
    USER_ASSIGNMENT_UPDATED: 'USER_ASSIGNMENT_UPDATED', // User assignment changes

    // Branch Events
    BRANCH_CREATED: 'BRANCH_CREATED',           // New branch created
    BRANCH_UPDATED: 'BRANCH_UPDATED',           // Branch details updated
    BRANCH_DELETED: 'BRANCH_DELETED',           // Branch deleted
    BRANCH_ASSIGNMENT_UPDATED: 'BRANCH_ASSIGNMENT_UPDATED', // Branch assignment changes

    // Analytics Events
    GROWTH_RATE_UPDATED: 'GROWTH_RATE_UPDATED',           // Growth rate metrics updated
    DASHBOARD_METRICS_UPDATED: 'DASHBOARD_METRICS_UPDATED', // Other dashboard metrics updated
} as const;

export type DashboardEventType = typeof DashboardEventTypes[keyof typeof DashboardEventTypes];

/**
 * Interface for dashboard update payloads
 */
export interface DashboardUpdatePayload {
    type: DashboardEventType;
    data: unknown;
}

/**
 * Helper function to create a properly typed dashboard update payload
 */
export function createDashboardUpdate(type: DashboardEventType, data: unknown): DashboardUpdatePayload {
    return {
        type,
        data
    };
}