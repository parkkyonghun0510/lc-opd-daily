import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getToken } from "next-auth/jwt";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format, subDays } from "date-fns";

const prisma = new PrismaClient();

// Helper function to convert Decimal to number
const toNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  return Number(value) || 0;
};

// GET /api/reports/consolidated - Get consolidated report data
export async function GET(request: NextRequest) {
  try {
    // Verify user authentication using NextAuth
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse date parameters
    const dateParam = searchParams.get("date");
    const fromDateParam = searchParams.get("fromDate");
    const toDateParam = searchParams.get("toDate");
    const periodParam = searchParams.get("period") || "day"; // 'day', 'week', 'month'

    let startDate: Date;
    let endDate: Date;
    let periodType: "day" | "week" | "month" = "day";

    // Check if we have a date range (fromDate and toDate)
    if (fromDateParam && toDateParam) {
      startDate = startOfDay(new Date(fromDateParam));
      endDate = endOfDay(new Date(toDateParam));
      
      // Determine period type based on date range
      const daysInRange = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysInRange > 60) {
        periodType = "month";
      } else if (daysInRange > 10) {
        periodType = "week";
      } else {
        periodType = "day";
      }
    }
    // Otherwise use single date + period
    else if (dateParam) {
      const date = new Date(dateParam);
      periodType = periodParam as "day" | "week" | "month";

      if (periodParam === "week") {
        startDate = startOfWeek(date, { weekStartsOn: 1 }); // Week starts on Monday
        endDate = endOfWeek(date, { weekStartsOn: 1 });
      } else if (periodParam === "month") {
        startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      } else {
        // day
        startDate = startOfDay(date);
        endDate = endOfDay(date);
      }
    } else {
      // Default to today
      const today = new Date();
      startDate = startOfDay(today);
      endDate = endOfDay(today);
      periodType = "day";
    }

    // Get all branches for counting
    const allBranches = await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    });

    // Get reports for the period
    const reports = await prisma.report.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        // Filter by report type if provided
        ...(searchParams.has("type")
          ? { reportType: searchParams.get("type") as "plan" | "actual" }
          : {}),
      },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    // Calculate aggregated metrics
    const totalWriteOffs = reports.reduce(
      (sum, report) => sum + toNumber(report.writeOffs),
      0
    );
    const totalNinetyPlus = reports.reduce(
      (sum, report) => sum + toNumber(report.ninetyPlus),
      0
    );

    // Get branch coverage
    const reportedBranchIds = [
      ...new Set(reports.map((report) => report.branchId)),
    ];
    const reportedBranches = reportedBranchIds.length;
    const totalBranches = allBranches.length;

    // Missing branches
    const missingBranchIds = allBranches
      .filter((branch) => !reportedBranchIds.includes(branch.id))
      .map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
      }));

    // Get historical data for trends
    const historicalData = [];
    
    const numDataPoints = 7; // Number of historical data points to fetch
    
    if (periodType === "day") {
      // Get daily data for the past N days
      for (let i = 0; i < numDataPoints; i++) {
        const currentDate = new Date(endDate);
        currentDate.setDate(currentDate.getDate() - i);

        const dayStart = startOfDay(currentDate);
        const dayEnd = endOfDay(currentDate);

        const dayReports = await prisma.report.findMany({
          where: {
            date: {
              gte: dayStart,
              lte: dayEnd,
            },
            ...(searchParams.has("type")
              ? { reportType: searchParams.get("type") as "plan" | "actual" }
              : {}),
          },
        });

        const dayWriteOffs = dayReports.reduce(
          (sum, report) => sum + toNumber(report.writeOffs),
          0
        );
        const dayNinetyPlus = dayReports.reduce(
          (sum, report) => sum + toNumber(report.ninetyPlus),
          0
        );

        historicalData.push({
          date: format(currentDate, "yyyy-MM-dd"),
          writeOffs: dayWriteOffs,
          ninetyPlus: dayNinetyPlus,
          count: dayReports.length,
        });
      }
    } else if (periodType === "week") {
      // Get weekly data for the past N weeks
      for (let i = 0; i < numDataPoints; i++) {
        const currentWeekStart = new Date(endDate);
        currentWeekStart.setDate(currentWeekStart.getDate() - i * 7);

        const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

        const weekReports = await prisma.report.findMany({
          where: {
            date: {
              gte: weekStart,
              lte: weekEnd,
            },
            ...(searchParams.has("type")
              ? { reportType: searchParams.get("type") as "plan" | "actual" }
              : {}),
          },
        });

        const weekWriteOffs = weekReports.reduce(
          (sum, report) => sum + toNumber(report.writeOffs),
          0
        );
        const weekNinetyPlus = weekReports.reduce(
          (sum, report) => sum + toNumber(report.ninetyPlus),
          0
        );

        historicalData.push({
          date: `${format(weekStart, "MMM d")} - ${format(
            weekEnd,
            "MMM d, yyyy"
          )}`,
          writeOffs: weekWriteOffs,
          ninetyPlus: weekNinetyPlus,
          count: weekReports.length,
        });
      }
    } else if (periodType === "month") {
      // Get monthly data for the past N months
      for (let i = 0; i < numDataPoints; i++) {
        const currentMonth = new Date(endDate);
        currentMonth.setMonth(currentMonth.getMonth() - i);

        const monthStart = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          1
        );
        const monthEnd = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + 1,
          0
        );

        const monthReports = await prisma.report.findMany({
          where: {
            date: {
              gte: monthStart,
              lte: monthEnd,
            },
            ...(searchParams.has("type")
              ? { reportType: searchParams.get("type") as "plan" | "actual" }
              : {}),
          },
        });

        const monthWriteOffs = monthReports.reduce(
          (sum, report) => sum + toNumber(report.writeOffs),
          0
        );
        const monthNinetyPlus = monthReports.reduce(
          (sum, report) => sum + toNumber(report.ninetyPlus),
          0
        );

        historicalData.push({
          date: format(monthStart, "MMMM yyyy"),
          writeOffs: monthWriteOffs,
          ninetyPlus: monthNinetyPlus,
          count: monthReports.length,
        });
      }
    }

    // Group data by branch
    const branchData = allBranches.map((branch) => {
      const branchReports = reports.filter(
        (report) => report.branchId === branch.id
      );
      const branchWriteOffs = branchReports.reduce(
        (sum, report) => sum + toNumber(report.writeOffs),
        0
      );
      const branchNinetyPlus = branchReports.reduce(
        (sum, report) => sum + toNumber(report.ninetyPlus),
        0
      );

      return {
        branchId: branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        writeOffs: branchWriteOffs,
        ninetyPlus: branchNinetyPlus,
        reportsCount: branchReports.length,
        hasReports: branchReports.length > 0,
      };
    });

    // Sort branches by write-offs amount (descending)
    branchData.sort((a, b) => b.writeOffs - a.writeOffs);

    // Generate the final response
    const response = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        type: periodType,
      },
      metrics: {
        totalWriteOffs,
        totalNinetyPlus,
        reportedBranches,
        totalBranches,
        coveragePercentage: (reportedBranches / totalBranches) * 100,
      },
      missingBranches: missingBranchIds,
      branchData,
      historicalData,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error generating consolidated report:", error);
    return NextResponse.json(
      { error: "Failed to generate consolidated report" },
      { status: 500 }
    );
  }
}
