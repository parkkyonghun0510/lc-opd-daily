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

export interface BranchDashboardSummaryData extends DashboardSummaryData {
  branchName?: string;
  branchStaff?: number;
  branchRank?: number;
  recentReports?: Array<{
    id: string;
    title: string;
    createdAt: string;
    status: string;
  }>;
}

export async function fetchDashboardSummary(
  options?: DashboardSummaryOptions
): Promise<{ status: number; data?: BranchDashboardSummaryData; error?: string }> {
  //console.log('[Dashboard Action] Fetching dashboard summary with options:', JSON.stringify(options, null, 2));
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;
    if (!user) {
      return { status: 401, error: 'Unauthorized' };
    }

    let accessibleBranchIds: string[] | undefined = undefined;
    console.log('[DEBUG] Fetching accessible branches for user:', user.id);
    if (user.role !== UserRole.ADMIN) {
      const branches = await getAccessibleBranches(user.id);
      accessibleBranchIds = branches.map(b => b.id);
      console.log('[DEBUG] Accessible branches:', accessibleBranchIds);
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
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const previousMonthStart = new Date(currentMonthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

    const currentMonthRevenue = await prisma.report.aggregate({
      _sum: { writeOffs: true, ninetyPlus: true },
      where: {
        createdAt: { gte: currentMonthStart.toISOString() },
        ...(accessibleBranchIds ? { branchId: { in: accessibleBranchIds } } : {}),
      },
    });

    const previousMonthRevenue = await prisma.report.aggregate({
      _sum: { writeOffs: true, ninetyPlus: true },
      where: {
        createdAt: {
          gte: previousMonthStart.toISOString(),
          lt: currentMonthStart.toISOString(),
        },
        ...(accessibleBranchIds ? { branchId: { in: accessibleBranchIds } } : {}),
      },
    });

    const currentRevenue = (currentMonthRevenue._sum.writeOffs?.toNumber() || 0) +
      (currentMonthRevenue._sum.ninetyPlus?.toNumber() || 0);
    const previousRevenue = (previousMonthRevenue._sum.writeOffs?.toNumber() || 0) +
      (previousMonthRevenue._sum.ninetyPlus?.toNumber() || 0);

    const growthRate = previousRevenue === 0
      ? currentRevenue > 0 ? 100 : 0
      : ((currentRevenue - previousRevenue) / previousRevenue) * 100;

    // --- Branch Manager Enhancements ---
    let branchName: string | undefined = undefined;
    let branchStaff: number | undefined = undefined;
    let branchRank: number | undefined = undefined;
    let recentReports: Array<{ id: string; title: string; createdAt: string; status: string }> | undefined = undefined;

    if (user.role === UserRole.BRANCH_MANAGER && accessibleBranchIds && accessibleBranchIds.length === 1) {
      const branchId = accessibleBranchIds[0];


      // 1. Branch Name
      const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
      branchName = branch?.name || "Your Branch";

      // 2. Branch Staff
      branchStaff = await prisma.user.count({ where: { branchId, isActive: true } });

      // 3. Branch Rank (by totalAmount)
      const allBranches = await prisma.branch.findMany({
        select: { id: true, name: true },
      });
      const branchRevenues = await Promise.all(
        allBranches.map(async b => {
          const agg = await prisma.report.aggregate({
            where: { branchId: b.id, status: "approved", reportType: "actual" },
            _sum: { writeOffs: true, ninetyPlus: true },
          });
          const revenue = (agg._sum.writeOffs?.toNumber() || 0) + (agg._sum.ninetyPlus?.toNumber() || 0);
          return { id: b.id, revenue };
        })
      );
      branchRevenues.sort((a, b) => b.revenue - a.revenue);
      branchRank = branchRevenues.findIndex(b => b.id === branchId) + 1;

      // 4. Recent Reports
      console.log('[DEBUG] Fetching recent reports for branch:', branchId);
      const reports = await prisma.report.findMany({
        where: { branchId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, reportType: true, createdAt: true, status: true },
      });
      console.log('[DEBUG] Recent reports fetched:', recentReports);
      recentReports = reports.map(r => ({
        id: r.id,
        title: r.reportType ?? `Report #${r.id}`,
        createdAt: r.createdAt.toISOString(),
        status: r.status,
      }));
    }
    // --- End Branch Manager Enhancements ---

    const summaryData: BranchDashboardSummaryData = {
      totalUsers: totalUsersCount,
      totalReports: totalReportsCount,
      pendingReports: pendingReportsCount,
      totalAmount: totalAmount,
      adminUsers: adminUsersCount,
      growthRate: growthRate,
      ...(customAggregations ? { customAggregations } : {}),
      ...(options?.dateRange ? { dateRange: options.dateRange } : {}),
      ...(branchName ? { branchName } : {}),
      ...(branchStaff !== undefined ? { branchStaff } : {}),
      ...(branchRank !== undefined ? { branchRank } : {}),
      ...(recentReports ? { recentReports } : {}),
    };

    //console.log('[Dashboard Action] Successfully fetched summary data:', JSON.stringify(summaryData, null, 2));
    return { status: 200, data: summaryData };

  } catch (error) {
    console.error('[Dashboard Action] Error fetching dashboard summary:', error);
    return { status: 500, error: 'Failed to fetch dashboard summary data' };
  }
}

/**
 * Fetches user-specific dashboard data for the user dashboard.
 * Includes: userReports, pendingReports, growthRate, recentActivities.
 */
export async function fetchUserDashboardData() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;
    if (!user) {
      return { status: 401, error: 'Unauthorized' };
    }
    const userId = user.id;
    const userRole = user.role;
    const prisma = require('@/lib/prisma').prisma || (await import('@/lib/prisma')).prisma;

    // Get user's branch (if not admin)
    let branchId: string | undefined = undefined;
    if (userRole !== UserRole.ADMIN) {
      const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { branchId: true } });
      branchId = dbUser?.branchId || undefined;
    }

    // 1. Reports created by the user
    const userReports = await prisma.report.count({ where: { submittedBy: userId } });

    // 2. Reports pending approval for user's branch
    let pendingReports = 0;
    if (userRole === UserRole.ADMIN) {
      pendingReports = await prisma.report.count({ where: { status: 'pending_approval' } });
    } else if (branchId) {
      pendingReports = await prisma.report.count({ where: { status: 'pending_approval', branchId } });
    }

    // 3. Growth rate (reuse logic from summary)
    // Calculate growth rate (comparing current month with previous month)
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const currentMonthStartStr = currentMonthStart.toISOString();
    const previousMonthStart = new Date(currentMonthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    const previousMonthStartStr = previousMonthStart.toISOString();

    const currentMonthData = await prisma.report.count({
      where: {
        submittedBy: userId,
        createdAt: { gte: currentMonthStartStr },
      },
    });
    const previousMonthData = await prisma.report.count({
      where: {
        submittedBy: userId,
        createdAt: { gte: previousMonthStartStr, lt: currentMonthStartStr },
      },
    });
    let growthRate = 0;
    if (previousMonthData === 0 && currentMonthData > 0) {
      growthRate = 100;
    } else if (previousMonthData > 0) {
      growthRate = ((currentMonthData - previousMonthData) / previousMonthData) * 100;
    }

    // 4. Recent activities (last 5 userActivity entries for the user)
    const recentActivitiesRaw = await prisma.userActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        action: true,
        details: true,
        createdAt: true,
      },
    });
    const recentActivities = recentActivitiesRaw.map((a: any) => ({
      description: a.action.replace(/_/g, ' ').toLowerCase(),
      details: a.details,
      timestamp: a.createdAt,
    }));

    // 5. Recent reports (last 5 created by the user)
    const recentReportsRaw = await prisma.report.findMany({
      where: { submittedBy: userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        date: true,
        branch: { select: { name: true } },
        status: true,
        reportType: true,
        submittedAt: true,
      },
    });
    const recentReports = recentReportsRaw.map((r: any) => ({
      id: r.id,
      date: r.date,
      branch: r.branch?.name || 'Unknown',
      status: r.status,
      reportType: r.reportType,
      submittedAt: r.submittedAt,
    }));

    return {
      status: 200,
      data: {
        userReports,
        pendingReports,
        growthRate: Math.round(growthRate * 100) / 100,
        recentActivities,
        recentReports,
      },
    };
  } catch (error) {
    console.error('[Dashboard Action] Error fetching user dashboard data:', error);
    return { status: 500, error: 'Failed to fetch user dashboard data' };
  }
}