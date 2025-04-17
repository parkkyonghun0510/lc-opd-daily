"use server";

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { getAccessibleBranches } from '@/lib/auth/branch-access';
import { UserRole } from '@/lib/auth/roles';
import { authOptions } from '@/lib/auth'; // Import authOptions

// Define the structure of the dashboard summary data
export interface DashboardSummaryData {
  totalUsers: number;
  totalReports: number;
  pendingReports: number;
  totalAmount: number;
  adminUsers: number;
  growthRate: number;
  // New flexible fields
  customAggregations?: Record<string, number>;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Fetches aggregated data for the admin dashboard.
 * Considers user permissions and accessible branches.
 */
interface FetchDashboardOptions {
  dateRange?: {
    start: Date;
    end: Date;
  };
  customFields?: string[];
  branchIds?: string[];
  cacheKey?: string;
}

export interface DashboardSummaryOptions {
  dateRange?: {
    start: Date;
    end: Date;
  };
  customAggregations?: string[];
  branchIds?: string[];
  useCache?: boolean;
}

export async function fetchDashboardSummary(
  options?: DashboardSummaryOptions
): Promise<{ status: number; data?: DashboardSummaryData; error?: string }> {
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
      gte: options.dateRange.start,
      lte: options.dateRange.end
    }
  } : {})
};
    
    // Apply optional filters
    const reportWhereClause = {
      ...baseReportWhereClause,
      ...(options?.dateRange && {
        createdAt: {
          gte: options.dateRange.start,
          lte: options.dateRange.end
        }
      }),
      ...(options?.branchIds && {
        branchId: { in: options.branchIds }
      })
    };

    // Fetch data concurrently
    // Prepare custom aggregations if requested
    const customAggregations = options?.customFields?.reduce((acc, field) => {
      acc[field] = true;
      return acc;
    }, {} as Record<string, true>);
    
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
        },
        where: reportWhereClause,
      }),
      prisma.user.count({ where: { role: UserRole.ADMIN, isActive: true } }),
    ]);

    const totalAmount = (reportAggregations._sum.writeOffs?.toNumber() || 0) +
                      (reportAggregations._sum.ninetyPlus?.toNumber() || 0);

// Calculate custom aggregations if requested
const customAggregations = options?.customAggregations ? 
  options.customAggregations.reduce((acc, field) => ({
    ...acc,
    [field]: reportAggregations._sum[field]?.toNumber() || 0
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

    return { status: 200, data: summaryData };

  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return { status: 500, error: 'Failed to fetch dashboard summary data' };
  }
}