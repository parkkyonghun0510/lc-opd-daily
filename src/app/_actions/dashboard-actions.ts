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
    amount?: number;
  }>;
}

export async function fetchDashboardSummary(
  options?: DashboardSummaryOptions
): Promise<{ status: number; data?: BranchDashboardSummaryData; error?: string }> {
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
        return { status: 200, data: { totalUsers: 0, totalReports: 0, pendingReports: 0, totalAmount: 0, adminUsers: 0, growthRate: 0 } };
      }
    }

    // Simplified where clause construction
    const reportWhereClause: Prisma.ReportWhereInput = {
      ...(accessibleBranchIds && { branchId: { in: accessibleBranchIds } }),
      ...(options?.branchIds && { branchId: { in: options.branchIds } }),
      ...(options?.dateRange && {
        createdAt: {
          gte: new Date(options.dateRange.start).toISOString(),
          lte: new Date(options.dateRange.end).toISOString(),
        },
      }),
    };

    // Prepare aggregation fields
    const aggregationFields: Prisma.ReportAggregateArgs = {
      _sum: {
        writeOffs: true,
        ninetyPlus: true,
        ...(options?.customAggregations?.reduce((acc, field) => ({
          ...acc,
          [field]: true
        }), {}))
      },
      where: reportWhereClause
    };

    // Fetch data concurrently with optimized selects
    const [totalUsersCount, totalReportsCount, pendingReportsCount, reportAggregations, adminUsersCount] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.report.count({ where: reportWhereClause }),
      prisma.report.count({ where: { ...reportWhereClause, status: 'pending_approval' } }),
      prisma.report.aggregate(aggregationFields),
      prisma.user.count({ where: { role: UserRole.ADMIN, isActive: true } }),
    ]);

    // Calculate total amount and custom aggregations with proper null checking
    const totalAmount = (reportAggregations._sum?.writeOffs?.toNumber() || 0) +
      (reportAggregations._sum?.ninetyPlus?.toNumber() || 0);

    const customAggregations = options?.customAggregations?.reduce((acc, field) => ({
      ...acc,
      [field]: ((reportAggregations._sum as Record<string, Prisma.Decimal | null>)?.[field])?.toNumber() || 0
    }), {} as Record<string, number>);

    // Optimized growth rate calculation with a single query
    const { currentRevenue, previousRevenue } = await prisma.$transaction(async (tx) => {
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);
      const previousMonthStart = new Date(currentMonthStart);
      previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

      const [current, previous] = await Promise.all([
        tx.report.aggregate({
          _sum: { writeOffs: true, ninetyPlus: true },
          where: {
            createdAt: { gte: currentMonthStart.toISOString() },
            ...(accessibleBranchIds ? { branchId: { in: accessibleBranchIds } } : {}),
          },
        }),
        tx.report.aggregate({
          _sum: { writeOffs: true, ninetyPlus: true },
          where: {
            createdAt: {
              gte: previousMonthStart.toISOString(),
              lt: currentMonthStart.toISOString(),
            },
            ...(accessibleBranchIds ? { branchId: { in: accessibleBranchIds } } : {}),
          },
        }),
      ]);

      return {
        currentRevenue: (current._sum.writeOffs?.toNumber() || 0) + (current._sum.ninetyPlus?.toNumber() || 0),
        previousRevenue: (previous._sum.writeOffs?.toNumber() || 0) + (previous._sum.ninetyPlus?.toNumber() || 0),
      };
    });

    const growthRate = previousRevenue === 0
      ? currentRevenue > 0 ? 100 : 0
      : ((currentRevenue - previousRevenue) / previousRevenue) * 100;

    // For branch manager data
    let branchData: Partial<BranchDashboardSummaryData> = {};
    if (user.role === UserRole.BRANCH_MANAGER && accessibleBranchIds?.length === 1) {
      const branchId = accessibleBranchIds[0];

      // Get branch data in a single transaction to ensure consistency
      const branchDetails = await prisma.$transaction(async (tx) => {
        const [branch, branchStaff, branchRevenues, recentReports] = await Promise.all([
          tx.branch.findUnique({
            where: { id: branchId },
            select: { name: true }
          }),
          tx.user.count({
            where: { branchId, isActive: true }
          }),
          tx.report.groupBy({
            by: ['branchId'],
            where: {
              status: "approved",
              reportType: "actual",
              // Add date range if needed
              ...(options?.dateRange && {
                createdAt: {
                  gte: new Date(options.dateRange.start).toISOString(),
                  lte: new Date(options.dateRange.end).toISOString(),
                }
              })
            },
            _sum: {
              writeOffs: true,
              ninetyPlus: true
            }
          }),
          tx.report.findMany({
            where: {
              branchId,
              // Add date range if needed
              ...(options?.dateRange && {
                createdAt: {
                  gte: new Date(options.dateRange.start).toISOString(),
                  lte: new Date(options.dateRange.end).toISOString(),
                }
              })
            },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              reportType: true,
              createdAt: true,
              status: true,
              date: true,
              writeOffs: true,
              ninetyPlus: true
            }
          })
        ]);

        // Calculate total revenue for each branch and sort for ranking
        const branchRevenuesMap = new Map(
          branchRevenues.map(b => [
            b.branchId,
            (b._sum.writeOffs?.toNumber() || 0) + (b._sum.ninetyPlus?.toNumber() || 0)
          ])
        );

        // Convert to array and sort by revenue to get rankings
        const sortedBranches = Array.from(branchRevenuesMap.entries())
          .sort(([, a], [, b]) => b - a);

        // Find current branch's rank
        const branchRank = sortedBranches.findIndex(([id]) => id === branchId) + 1;

        return {
          branch,
          branchStaff,
          branchRank,
          recentReports
        };
      });

      branchData = {
        branchName: branchDetails.branch?.name || "Welcome to the Dashboard",
        branchStaff: branchDetails.branchStaff,
        branchRank: branchDetails.branchRank,
        recentReports: branchDetails.recentReports.map(r => ({
          id: r.id,
          title: `${r.reportType} Report - ${new Date(r.date).toLocaleDateString()}`,
          createdAt: r.createdAt.toISOString(),
          status: r.status,
          amount: (r.writeOffs?.toNumber() || 0) + (r.ninetyPlus?.toNumber() || 0)
        }))
      };
    }

    const summaryData: BranchDashboardSummaryData = {
      totalUsers: totalUsersCount,
      totalReports: totalReportsCount,
      pendingReports: pendingReportsCount,
      totalAmount,
      adminUsers: adminUsersCount,
      growthRate,
      ...(customAggregations && { customAggregations }),
      ...(options?.dateRange && { dateRange: options.dateRange }),
      ...branchData
    };

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

    // Use transaction for consistent data snapshot and parallel queries
    const data = await prisma.$transaction(async (tx) => {
      // Get user's branch and counts in parallel
      const [
        dbUser,
        userReports,
        { currentMonthData, previousMonthData },
        recentActivities,
        recentReports
      ] = await Promise.all([
        // Get user's branch (if not admin)
        userRole !== UserRole.ADMIN
          ? tx.user.findUnique({
            where: { id: userId },
            select: { branchId: true }
          })
          : null,

        // 1. Reports created by the user
        tx.report.count({
          where: { submittedBy: userId }
        }),

        // 2. Growth rate data
        (async () => {
          const currentMonthStart = new Date();
          currentMonthStart.setDate(1);
          currentMonthStart.setHours(0, 0, 0, 0);
          const previousMonthStart = new Date(currentMonthStart);
          previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

          const [current, previous] = await Promise.all([
            tx.report.count({
              where: {
                submittedBy: userId,
                createdAt: { gte: currentMonthStart.toISOString() },
              },
            }),
            tx.report.count({
              where: {
                submittedBy: userId,
                createdAt: {
                  gte: previousMonthStart.toISOString(),
                  lt: currentMonthStart.toISOString()
                },
              },
            }),
          ]);

          return { currentMonthData: current, previousMonthData: previous };
        })(),

        // 3. Recent activities
        tx.userActivity.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            action: true,
            details: true,
            createdAt: true,
          },
        }),

        // 4. Recent reports with branch info
        tx.report.findMany({
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
        }),
      ]);

      // Get pending reports count based on role and branch
      const pendingReports = await (async () => {
        if (userRole === UserRole.ADMIN) {
          return tx.report.count({ where: { status: 'pending_approval' } });
        } else if (dbUser?.branchId) {
          return tx.report.count({
            where: {
              status: 'pending_approval',
              branchId: dbUser.branchId
            }
          });
        }
        return 0;
      })();

      // Calculate growth rate
      let growthRate = 0;
      if (previousMonthData === 0 && currentMonthData > 0) {
        growthRate = 100;
      } else if (previousMonthData > 0) {
        growthRate = ((currentMonthData - previousMonthData) / previousMonthData) * 100;
      }

      return {
        userReports,
        pendingReports,
        growthRate: Math.round(growthRate * 100) / 100,
        recentActivities: recentActivities.map(a => ({
          description: a.action.replace(/_/g, ' ').toLowerCase(),
          details: a.details,
          timestamp: a.createdAt,
        })),
        recentReports: recentReports.map(r => ({
          id: r.id,
          date: r.date,
          branch: r.branch?.name || 'Unknown',
          status: r.status,
          reportType: r.reportType,
          submittedAt: r.submittedAt,
        })),
      };
    });

    return { status: 200, data };

  } catch (error) {
    console.error('[Dashboard Action] Error fetching user dashboard data:', error);
    return { status: 500, error: 'Failed to fetch user dashboard data' };
  }
}