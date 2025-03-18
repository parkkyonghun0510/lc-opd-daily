/**
 * Utility functions for API calls with authentication and error handling
 */

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