"use server";

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { getAccessibleBranches } from '@/lib/auth/branch-access';
import { UserRole } from '@/lib/auth/roles';
import { authOptions } from '@/lib/auth'; // Import authOptions
import { Prisma } from '@prisma/client';

// Define the structure of the dashboard summary data
/**
 * Represents summary data for the dashboard, including user, report, and financial statistics.
 */
export interface DashboardSummaryData {
  /** Total number of users in the system */
  totalUsers: number;
  /** Total number of reports generated */
  totalReports: number;
  /** Number of reports pending review or action */
  pendingReports: number;
  /** Total financial amount (currency context-dependent) */
  totalAmount: number;
  /** Number of admin users */
  adminUsers: number;
  /** Growth rate percentage (e.g., 0.15 for 15%) */
  growthRate: number;
  /**
   * Flexible map for custom aggregations (e.g., per department, region, etc.)
   * Key is aggregation name, value is the numeric result.
   */
  customAggregations?: Record<string, number>;
  /**
   * Date range for the summary data, using ISO string for serialization safety.
   */
  dateRange?: DateRange;
}

/**
 * Represents a date range using ISO string format for API compatibility.
 */
export type DateRange = {
  start: string; // ISO date string (e.g., '2025-04-17T00:00:00Z')
  end: string;   // ISO date string
};

/**
 * Fetches aggregated data for the admin dashboard.
 * Considers user permissions and accessible branches.
 */
interface FetchDashboardOptions {
  /**
   * Date range for fetching dashboard data (ISO string format).
   */
  dateRange?: DateRange;
  customFields?: string[];
  branchIds?: string[];
  cacheKey?: string;
}

export interface DashboardSummaryOptions {
  /**
   * Date range for dashboard summary (ISO string format).
   */
  dateRange?: DateRange;
  customAggregations?: string[];
  branchIds?: string[];
  useCache?: boolean;
}

export async function fetchDashboardSummary(
  options?: DashboardSummaryOptions
): Promise<{ status: number; data?: DashboardSummaryData; error?: string }> {
  //console.log('[Dashboard Action] Fetching dashboard summary with options:', JSON.stringify(options, null, 2));
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;
    if (!user) {
      return { status: 401, error: 'Unauthorized' };
    }

    let accessibleBranchIds: string[] | undefined = undefined;
    if (user.role !== UserRole.ADMIN) {
      const branches = await getAccessibleBranches(user.id);
      accessibleBranchIds = branches.map(b => b.id);
      if (accessibleBranchIds.length === 0) {
        // Non-admin users must have access to at least one branch
        // This case should ideally be handled earlier (e.g., login), but added as a safeguard
        console.warn(`User ${user.id} has no accessible branches.`);
        // Return empty/zeroed data or an error depending on desired behavior
        return { status: 200, data: { totalUsers: 0, totalReports: 0, pendingReports: 0, totalAmount: 0, adminUsers: 0, growthRate: 0 } };
      }
    }

    // Build the where clause for reports based on accessible branches
    const baseReportWhereClause = {
      ...(accessibleBranchIds ? { branchId: { in: accessibleBranchIds } } : {}),
      ...(options?.dateRange ? {
        createdAt: {
          gte: typeof options.dateRange.start === 'string' ? options.dateRange.start : new Date(options.dateRange.start).toISOString(),
          lte: typeof options.dateRange.end === 'string' ? options.dateRange.end : new Date(options.dateRange.end).toISOString(),
        }
      } : {})
    };

    // Apply optional filters
    const reportWhereClause = {
      ...baseReportWhereClause,
      ...(options?.dateRange && {
        createdAt: {
          gte: typeof options.dateRange.start === 'string' ? options.dateRange.start : new Date(options.dateRange.start).toISOString(),
          lte: typeof options.dateRange.end === 'string' ? options.dateRange.end : new Date(options.dateRange.end).toISOString(),
        }
      }),
      ...(options?.branchIds && {
        branchId: { in: options.branchIds }
      })
    };

    // Fetch data concurrently
    // Removed customFields reducer: not part of DashboardSummaryOptions


    const aggregationFields = {
      _sum: {
        writeOffs: true,
        ninetyPlus: true,
        ...(options?.customAggregations ?
          options.customAggregations.reduce((acc, field) => ({
            ...acc,
            [field]: true
          }), {}) : {})
      }
    };

    const [totalUsersCount, totalReportsCount, pendingReportsCount, reportAggregations, adminUsersCount] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }), // Count only active users
      prisma.report.count({ where: reportWhereClause }),
      prisma.report.count({ where: { ...reportWhereClause, status: 'pending_approval' } }),
      prisma.report.aggregate({
        _sum: {
          writeOffs: true,
          ninetyPlus: true,
          // Allow dynamic fields for customAggregations
          ...(options?.customAggregations ? options.customAggregations.reduce((acc: Record<string, true>, field: string) => {
            acc[field] = true;
            return acc;
          }, {}) : {})
        },
        where: reportWhereClause,
      }),
      prisma.user.count({ where: { role: UserRole.ADMIN, isActive: true } }),
    ]);

    const totalAmount = (reportAggregations._sum.writeOffs?.toNumber() || 0) +
      (reportAggregations._sum.ninetyPlus?.toNumber() || 0);

    // Calculate custom aggregations if requested
    // TypeScript: cast _sum as Record<string, Decimal | null> for dynamic custom fields
    const customAggregations = options?.customAggregations ?
      options.customAggregations.reduce((acc: Record<string, number>, field: string) => ({
        ...acc,
        [field]: (reportAggregations._sum as Record<string, Prisma.Decimal | null>)[field]?.toNumber() || 0
      }), {}) : undefined;

    // Placeholder for growth rate calculation (requires historical data)
    const growthRate = 100; // Replace with actual calculation later

    const summaryData: DashboardSummaryData = {
      totalUsers: totalUsersCount,
      totalReports: totalReportsCount,
      pendingReports: pendingReportsCount,
      totalAmount: totalAmount,
      adminUsers: adminUsersCount,
      growthRate: growthRate,
      ...(customAggregations ? { customAggregations } : {}),
      ...(options?.dateRange ? { dateRange: options.dateRange } : {})
    };

    //console.log('[Dashboard Action] Successfully fetched summary data:', JSON.stringify(summaryData, null, 2));
    return { status: 200, data: summaryData };

  } catch (error) {
    console.error('[Dashboard Action] Error fetching dashboard summary:', error);
    return { status: 500, error: 'Failed to fetch dashboard summary data' };
  }
}