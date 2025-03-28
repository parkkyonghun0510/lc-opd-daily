/**
 * Utility functions for API calls with authentication and error handling
 */

import { NotificationType } from '@/utils/notificationTemplates';

type FetchOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
};

/**
 * Make a secure API call with proper error handling
 * @param url API endpoint URL
 * @param options Fetch options
 * @returns Promise with parsed JSON response
 */
export async function secureApiCall<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    credentials: 'include', // Always include cookies for authentication
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  };

  const response = await fetch(url, fetchOptions);

  // Handle redirects (likely to login page)
  if (response.redirected) {
    if (typeof window !== 'undefined') {
      window.location.href = response.url;
    }
    throw new Error('Authentication required. Redirecting to login page.');
  }

  // Handle HTTP error responses
  if (!response.ok) {
    // Try to parse error as JSON if possible
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status} ${response.statusText}`);
      }
    } catch (parseError) {
      // If JSON parsing fails, throw generic error
    }
    
    // Default error message
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  // Verify we received JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Invalid response format. Expected JSON.');
  }

  return response.json();
}

/**
 * Fetch users with proper authentication
 * @param queryParams Optional query string to append to the URL
 */
export async function fetchUsers(queryParams?: string) {
  return secureApiCall<{ users: any[], total: number, page: number, limit: number, pages: number }>(
    `/api/users${queryParams || ''}`
  );
}

/**
 * Fetch branches with proper authentication
 */
export async function fetchBranches() {
  return secureApiCall<any[]>('/api/branches');
}

/**
 * Assign role to user
 */
export async function assignUserRole(userId: string, roleName: string, branchId: string | null = null) {
  const response = await fetch("/api/admin/roles/assign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, roleName, branchId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to assign role");
  }

  return response.json();
}

export async function fetchAdminStats() {
  const response = await fetch("/api/admin/stats");
  if (!response.ok) {
    throw new Error("Failed to fetch admin stats");
  }
  return response.json();
}

/**
 * Send a notification for report approval status
 * @param type The type of notification
 * @param data Data related to the notification
 * @returns Result of the notification creation
 */
export async function sendReportNotification(type: NotificationType, data: Record<string, any>) {
  return secureApiCall<{ success: boolean; messageId?: string; userCount?: number }>('/api/notifications/send', {
    method: 'POST',
    body: { type, data }
  });
}

/**
 * Send a notification when a report is approved
 * @param reportId ID of the approved report
 * @param approverName Name of the person who approved the report
 * @param additionalData Any additional data to include
 */
export async function sendReportApprovedNotification(
  reportId: string, 
  approverName: string,
  additionalData: Record<string, any> = {}
) {
  return sendReportNotification(NotificationType.REPORT_APPROVED, {
    reportId,
    approverName,
    ...additionalData
  });
}

/**
 * Send a notification when a report is rejected
 * @param reportId ID of the rejected report
 * @param approverName Name of the person who rejected the report
 * @param reason Optional reason for rejection
 * @param additionalData Any additional data to include
 */
export async function sendReportRejectedNotification(
  reportId: string, 
  approverName: string,
  reason?: string,
  additionalData: Record<string, any> = {}
) {
  return sendReportNotification(NotificationType.REPORT_REJECTED, {
    reportId,
    approverName,
    reason,
    ...additionalData
  });
}

/**
 * Send a notification when a report is submitted and needs approval
 * @param reportId ID of the submitted report
 * @param submitterName Name of the person who submitted the report
 * @param branchId Branch ID related to the report
 * @param additionalData Any additional data to include
 */
export async function sendReportSubmittedNotification(
  reportId: string,
  submitterName: string,
  branchId: string,
  additionalData: Record<string, any> = {}
) {
  return sendReportNotification(NotificationType.REPORT_SUBMITTED, {
    reportId,
    submitterName,
    branchId,
    ...additionalData
  });
}

/**
 * Send report due date reminders
 * @param branchId Branch ID for which reports are due
 * @param date Due date for the reports
 * @param additionalData Any additional data to include
 */
export async function sendReportReminderNotification(
  branchId: string,
  date: string,
  additionalData: Record<string, any> = {}
) {
  return sendReportNotification(NotificationType.REPORT_REMINDER, {
    branchId,
    date,
    ...additionalData
  });
} 