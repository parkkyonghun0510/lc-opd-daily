export const notificationTemplates = {
    REPORT_SUBMITTED: {
        title: 'New Report Submitted',
        body: (data) => `A new report has been submitted by ${data.submitterName || 'a user'} and requires review.`,
        icon: '/icons/report.png',
        url: (data) => `/reports/${data.reportId}`,
    },
    REPORT_APPROVED: {
        title: 'Report Approved',
        body: (data) => `Your report has been approved by ${data.approverName || 'a manager'}.`,
        icon: '/icons/approved.png',
        url: (data) => `/reports/${data.reportId}`,
    },
    REPORT_REJECTED: {
        title: 'Report Rejected',
        body: (data) => `Your report has been rejected by ${data.approverName || 'a manager'}. Please review the feedback.`,
        icon: '/icons/rejected.png',
        url: (data) => `/reports/${data.reportId}`,
    },
    REPORT_NEEDS_REVISION: {
        title: 'Report Needs Revision',
        body: (data) => `Your report requires revisions as requested by ${data.requesterName || 'a manager'}.`,
        icon: '/icons/revision.png',
        url: (data) => `/reports/${data.reportId}`,
    },
    APPROVAL_PENDING: {
        title: 'Approval Required',
        body: (data) => `A report is awaiting your approval.`,
        icon: '/icons/pending.png',
        url: (data) => `/reports/${data.reportId}`,
    },
    COMMENT_ADDED: {
        title: 'New Comment Added',
        body: (data) => `${data.commenterName || 'Someone'} added a comment to a report you're involved with.`,
        icon: '/icons/comment.png',
        url: (data) => `/reports/${data.reportId}`,
    },
    GENERAL_ANNOUNCEMENT: {
        title: 'Announcement',
        body: (data) => data.message || 'Important announcement from the system.',
        icon: '/icons/announcement.png',
        url: (data) => data.url || '/',
    },
    TEST_NOTIFICATION: {
        title: 'Test Notification',
        body: (data) => data.message || 'This is a test notification.',
        icon: '/icons/test.png',
        url: (data) => '/',
    }
};
/**
 * Generate notification content based on type and data
 */
export function generateNotificationContent(type, data) {
    const template = notificationTemplates[type];
    if (!template) {
        throw new Error(`No template found for notification type: ${type}`);
    }
    return {
        title: template.title,
        body: template.body(data),
        icon: template.icon || '/icons/default.png',
        url: template.url ? template.url(data) : '/',
    };
}
