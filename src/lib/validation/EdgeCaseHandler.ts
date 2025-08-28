import { useCallback, useMemo } from 'react';
import { z } from 'zod';

// Validation schemas
const reportStatusSchema = z.enum(['pending', 'pending_approval', 'approved', 'rejected']);
const reportTypeSchema = z.enum(['plan', 'actual']);

const branchSchema = z.object({
  id: z.string().min(1, 'Branch ID is required'),
  name: z.string().min(1, 'Branch name is required'),
  code: z.string().optional(),
});

const userSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  name: z.string().min(1, 'User name is required'),
  username: z.string().min(1, 'Username is required'),
});

const reportCommentSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1, 'Comment content is required'),
  userId: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  reportId: z.string().min(1),
  user: userSchema,
});

const reportSchema = z.object({
  id: z.string().min(1, 'Report ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  writeOffs: z.number().min(0, 'Write-offs must be non-negative'),
  ninetyPlus: z.number().min(0, '90+ days must be non-negative'),
  status: reportStatusSchema,
  reportType: reportTypeSchema,
  content: z.string().optional(),
  submittedBy: z.string().optional(),
  date: z.string().refine(
    (date) => !isNaN(Date.parse(date)), 
    'Invalid date format'
  ),
  submittedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
  comments: z.string().nullable(),
  planReportId: z.string().nullable(),
  branch: branchSchema,
  user: userSchema.optional(),
  ReportComment: z.array(reportCommentSchema),
});

const filterStateSchema = z.object({
  searchTerm: z.string(),
  branchFilter: z.string(),
  reportTypeFilter: z.string(),
  statusFilter: z.string(),
  dateRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).refine(
    (range) => {
      if (range.from && range.to) {
        return range.from <= range.to;
      }
      return true;
    },
    'Start date must be before or equal to end date'
  ),
  sortField: z.enum(['date', 'created', 'branch', 'writeOffs', 'ninetyPlus']),
  sortDirection: z.enum(['asc', 'desc']),
  currentPage: z.number().min(1, 'Page must be at least 1'),
});

// Edge case handlers
export class EdgeCaseHandler {
  // Validate and sanitize report data
  static validateReport(report: any): { isValid: boolean; errors: string[]; sanitizedReport?: any } {
    try {
      // Handle potential date conversion issues
      const sanitizedReport = {
        ...report,
        submittedAt: new Date(report.submittedAt),
        createdAt: new Date(report.createdAt),
        updatedAt: new Date(report.updatedAt),
        ReportComment: (report.ReportComment || []).map((comment: any) => ({
          ...comment,
          createdAt: new Date(comment.createdAt),
          updatedAt: new Date(comment.updatedAt),
        })),
      };

      const result = reportSchema.safeParse(sanitizedReport);
      
      if (result.success) {
        return {
          isValid: true,
          errors: [],
          sanitizedReport: result.data,
        };
      } else {
        return {
          isValid: false,
          errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  // Validate filter state
  static validateFilterState(filters: any): { isValid: boolean; errors: string[]; sanitizedFilters?: any } {
    try {
      const result = filterStateSchema.safeParse(filters);
      
      if (result.success) {
        return {
          isValid: true,
          errors: [],
          sanitizedFilters: result.data,
        };
      } else {
        return {
          isValid: false,
          errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Filter validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  // Handle malformed data gracefully
  static sanitizeReportData(reports: any[]): any[] {
    if (!Array.isArray(reports)) {
      console.warn('Reports data is not an array, returning empty array');
      return [];
    }

    return reports
      .map((report, index) => {
        try {
          // Basic sanitization
          const sanitized = {
            id: String(report?.id || `fallback-${index}`),
            branchId: String(report?.branchId || ''),
            writeOffs: this.sanitizeNumber(report?.writeOffs),
            ninetyPlus: this.sanitizeNumber(report?.ninetyPlus),
            status: this.sanitizeStatus(report?.status),
            reportType: this.sanitizeReportType(report?.reportType),
            content: report?.content || '',
            submittedBy: report?.submittedBy || '',
            date: this.sanitizeDate(report?.date),
            submittedAt: this.sanitizeDate(report?.submittedAt, new Date()),
            createdAt: this.sanitizeDate(report?.createdAt, new Date()),
            updatedAt: this.sanitizeDate(report?.updatedAt, new Date()),
            comments: report?.comments || null,
            planReportId: report?.planReportId || null,
            branch: this.sanitizeBranch(report?.branch),
            user: this.sanitizeUser(report?.user),
            ReportComment: this.sanitizeComments(report?.ReportComment),
          };

          return sanitized;
        } catch (error) {
          console.error(`Error sanitizing report at index ${index}:`, error);
          return null;
        }
      })
      .filter(Boolean); // Remove null entries
  }

  private static sanitizeNumber(value: any, fallback = 0): number {
    if (typeof value === 'number' && !isNaN(value)) {
      return Math.max(0, value); // Ensure non-negative
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return Math.max(0, parsed);
      }
    }
    return fallback;
  }

  private static sanitizeStatus(status: any): string {
    const validStatuses = ['pending', 'pending_approval', 'approved', 'rejected'];
    if (typeof status === 'string' && validStatuses.includes(status)) {
      return status;
    }
    return 'pending';
  }

  private static sanitizeReportType(type: any): string {
    const validTypes = ['plan', 'actual'];
    if (typeof type === 'string' && validTypes.includes(type)) {
      return type;
    }
    return 'actual';
  }

  private static sanitizeDate(date: any, fallback?: Date): Date | string {
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date;
    }
    
    if (typeof date === 'string') {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
      
      // Try to parse ISO string format
      const isoMatch = date.match(/^\d{4}-\d{2}-\d{2}/);
      if (isoMatch) {
        return date; // Return as string for date-only formats
      }
    }

    if (fallback) {
      return fallback;
    }

    return new Date(); // Current date as ultimate fallback
  }

  private static sanitizeBranch(branch: any): any {
    if (!branch || typeof branch !== 'object') {
      return {
        id: 'unknown',
        name: 'Unknown Branch',
        code: '',
      };
    }

    return {
      id: String(branch.id || 'unknown'),
      name: String(branch.name || 'Unknown Branch'),
      code: String(branch.code || ''),
    };
  }

  private static sanitizeUser(user: any): any {
    if (!user || typeof user !== 'object') {
      return undefined;
    }

    return {
      id: String(user.id || ''),
      name: String(user.name || 'Unknown User'),
      username: String(user.username || ''),
    };
  }

  private static sanitizeComments(comments: any): any[] {
    if (!Array.isArray(comments)) {
      return [];
    }

    return comments
      .map((comment, index) => {
        try {
          if (!comment || typeof comment !== 'object') {
            return null;
          }

          return {
            id: String(comment.id || `comment-${index}`),
            content: String(comment.content || ''),
            userId: String(comment.userId || ''),
            createdAt: this.sanitizeDate(comment.createdAt, new Date()),
            updatedAt: this.sanitizeDate(comment.updatedAt, new Date()),
            reportId: String(comment.reportId || ''),
            user: this.sanitizeUser(comment.user),
          };
        } catch (error) {
          console.error(`Error sanitizing comment at index ${index}:`, error);
          return null;
        }
      })
      .filter(Boolean);
  }

  // Handle network errors gracefully
  static handleNetworkError(error: any): { type: string; message: string; retry: boolean } {
    if (!error) {
      return {
        type: 'unknown',
        message: 'An unknown error occurred',
        retry: true,
      };
    }

    const errorMessage = error.message || String(error);
    const lowerMessage = errorMessage.toLowerCase();

    // Network connectivity issues
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return {
        type: 'network',
        message: 'Network connection failed. Please check your internet connection.',
        retry: true,
      };
    }

    // Timeout errors
    if (lowerMessage.includes('timeout')) {
      return {
        type: 'timeout',
        message: 'Request timed out. The server may be busy.',
        retry: true,
      };
    }

    // Server errors
    if (error.status >= 500) {
      return {
        type: 'server',
        message: 'Server error occurred. Please try again later.',
        retry: true,
      };
    }

    // Client errors
    if (error.status >= 400 && error.status < 500) {
      return {
        type: 'client',
        message: 'Request failed. Please check your input and try again.',
        retry: false,
      };
    }

    // Authentication errors
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('auth')) {
      return {
        type: 'auth',
        message: 'Authentication failed. Please log in again.',
        retry: false,
      };
    }

    // Generic error
    return {
      type: 'generic',
      message: errorMessage || 'An unexpected error occurred',
      retry: true,
    };
  }

  // Validate pagination parameters
  static validatePagination(page: number, totalItems: number, itemsPerPage = 10): {
    isValid: boolean;
    adjustedPage: number;
    totalPages: number;
  } {
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    
    if (page < 1) {
      return {
        isValid: false,
        adjustedPage: 1,
        totalPages,
      };
    }

    if (page > totalPages) {
      return {
        isValid: false,
        adjustedPage: totalPages,
        totalPages,
      };
    }

    return {
      isValid: true,
      adjustedPage: page,
      totalPages,
    };
  }

  // Handle empty states gracefully
  static handleEmptyState(data: any[], isLoading: boolean, error: string | null): {
    showEmpty: boolean;
    emptyType: 'loading' | 'error' | 'no-data' | 'filtered';
    message: string;
  } {
    if (isLoading) {
      return {
        showEmpty: false,
        emptyType: 'loading',
        message: 'Loading...',
      };
    }

    if (error) {
      return {
        showEmpty: true,
        emptyType: 'error',
        message: 'Failed to load data. Please try again.',
      };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        showEmpty: true,
        emptyType: 'no-data',
        message: 'No reports found.',
      };
    }

    return {
      showEmpty: false,
      emptyType: 'no-data',
      message: '',
    };
  }
}

// React hook for validation and edge case handling
export function useValidation() {
  const validateReport = useCallback((report: any) => {
    return EdgeCaseHandler.validateReport(report);
  }, []);

  const validateFilterState = useCallback((filters: any) => {
    return EdgeCaseHandler.validateFilterState(filters);
  }, []);

  const sanitizeReportData = useCallback((reports: any[]) => {
    return EdgeCaseHandler.sanitizeReportData(reports);
  }, []);

  const handleNetworkError = useCallback((error: any) => {
    return EdgeCaseHandler.handleNetworkError(error);
  }, []);

  const validatePagination = useCallback((page: number, totalItems: number, itemsPerPage = 10) => {
    return EdgeCaseHandler.validatePagination(page, totalItems, itemsPerPage);
  }, []);

  const handleEmptyState = useCallback((data: any[], isLoading: boolean, error: string | null) => {
    return EdgeCaseHandler.handleEmptyState(data, isLoading, error);
  }, []);

  return {
    validateReport,
    validateFilterState,
    sanitizeReportData,
    handleNetworkError,
    validatePagination,
    handleEmptyState,
  };
}

// Validation schemas export for reuse
export const schemas = {
  report: reportSchema,
  filterState: filterStateSchema,
  branch: branchSchema,
  user: userSchema,
  reportComment: reportCommentSchema,
  reportStatus: reportStatusSchema,
  reportType: reportTypeSchema,
};

export default EdgeCaseHandler;