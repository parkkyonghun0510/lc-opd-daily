import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getToken } from "next-auth/jwt";
import { UserRole } from "@/lib/auth/roles";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
  isValid,
} from "date-fns";

interface AnalyticsParams {
  timeRange?: string;
  branchId?: string;
  startDate?: Date;
  endDate?: Date;
}

// Define types to match the database schema
interface Report {
  id: string;
  branchId: string;
  date: Date;
  status: string;
  totalPatients?: number;
  generalMedicine?: number;
  pediatrics?: number;
  surgery?: number;
  obstetrics?: number;
  orthopedics?: number;
  dental?: number;
  ophthalmology?: number;
  otherPatients?: number;
  submittedBy: string;
  createdAt: Date;
  updatedAt: Date;
  branch: {
    id: string;
    name: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const timeRange = url.searchParams.get("timeRange") || "month";
    const branchId = url.searchParams.get("branch") || "all";

    // Parse dates with validation
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    if (fromParam) {
      fromDate = new Date(fromParam);
      if (!isValid(fromDate)) {
        return NextResponse.json(
          { error: "Invalid 'from' date format" },
          { status: 400 },
        );
      }
    }

    if (toParam) {
      toDate = new Date(toParam);
      if (!isValid(toDate)) {
        return NextResponse.json(
          { error: "Invalid 'to' date format" },
          { status: 400 },
        );
      }
    }

    // Set date range based on time range or explicit dates
    let startDate: Date;
    let endDate: Date;

    if (fromDate && toDate) {
      startDate = startOfDay(fromDate);
      endDate = endOfDay(toDate);

      // Validate that start date is before end date
      if (startDate > endDate) {
        return NextResponse.json(
          { error: "Start date must be before end date" },
          { status: 400 },
        );
      }
    } else {
      const now = new Date();
      switch (timeRange) {
        case "week":
          startDate = startOfWeek(now);
          endDate = endOfWeek(now);
          break;
        case "month":
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case "quarter":
          startDate = startOfMonth(subDays(now, 90));
          endDate = endOfDay(now);
          break;
        case "year":
          startDate = startOfYear(now);
          endDate = endOfYear(now);
          break;
        default:
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
      }
    }

    // Validate branch access permission
    if (branchId !== "all" && token.role !== UserRole.ADMIN) {
      // Check if the user has access to the requested branch
      if (token.branchId !== branchId) {
        return NextResponse.json(
          { error: "You don't have permission to access this branch's data" },
          { status: 403 },
        );
      }
    }

    // Prepare branch filter
    const branchFilter =
      branchId === "all"
        ? token.role === UserRole.ADMIN
          ? {}
          : { branchId: token.branchId as string }
        : { branchId };

    // Fetch reports data within date range - Correct the query to match schema
    const reports = (await prisma.report.findMany({
      where: {
        ...branchFilter,
        date: {
          gte: startDate.toISOString(),
          lte: endDate.toISOString(),
        },
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    })) as unknown as Report[];

    // Fetch branch data
    const branches = await prisma.branch.findMany({
      where:
        token.role === UserRole.ADMIN ? {} : { id: token.branchId as string },
      select: {
        id: true,
        name: true,
      },
    });

    // Calculate daily trends
    const dailyReportMap = new Map();
    const dayCount = Math.max(
      1,
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    // Initialize with zero values
    for (let i = 0; i < dayCount; i++) {
      const date = subDays(endDate, i);
      const dateStr = format(date, "yyyy-MM-dd");
      dailyReportMap.set(dateStr, {
        date: format(date, "MMM dd"),
        patients: 0,
        reports: 0,
      });
    }

    // Fill with actual data
    reports.forEach((report) => {
      try {
        const dateStr = format(new Date(report.date), "yyyy-MM-dd");
        if (dailyReportMap.has(dateStr)) {
          const day = dailyReportMap.get(dateStr);
          day.patients += report.totalPatients || 0;
          day.reports += 1;
          dailyReportMap.set(dateStr, day);
        }
      } catch (e) {
        console.error("Error processing report:", e);
        // Continue with next report
      }
    });

    const dailyTrends = Array.from(dailyReportMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .reverse();

    // Calculate branch performance
    const branchPerformance = branches.map((branch) => {
      const branchReports = reports.filter((r) => r.branchId === branch.id);
      const totalPatients = branchReports.reduce(
        (sum, r) => sum + (r.totalPatients || 0),
        0,
      );

      return {
        id: branch.id,
        name: branch.name,
        patients: totalPatients,
        reports: branchReports.length,
        averagePatients: branchReports.length
          ? Math.round(totalPatients / branchReports.length)
          : 0,
      };
    });

    // Calculate patient categories
    const categories = [
      { name: "General Medicine", key: "generalMedicine" },
      { name: "Pediatrics", key: "pediatrics" },
      { name: "Surgery", key: "surgery" },
      { name: "Obstetrics", key: "obstetrics" },
      { name: "Orthopedics", key: "orthopedics" },
      { name: "Dental", key: "dental" },
      { name: "Ophthalmology", key: "ophthalmology" },
      { name: "Other", key: "otherPatients" },
    ];

    const patientCategories = categories
      .map((category) => {
        const total = reports.reduce((sum, report) => {
          return sum + ((report[category.key as keyof Report] as number) || 0);
        }, 0);

        return {
          name: category.name,
          value: total,
        };
      })
      .filter((cat) => cat.value > 0);

    // Get recent reports
    const recentReports = reports.slice(0, 5).map((report) => ({
      id: report.id,
      date: report.date,
      branch: report.branch.name,
      patients: report.totalPatients || 0,
      status: report.status,
      submittedBy: report.submittedBy,
    }));

    // Total statistics
    const totalPatients = reports.reduce(
      (sum, r) => sum + (r.totalPatients || 0),
      0,
    );
    const totalReports = reports.length;
    const averagePatients = totalReports
      ? Math.round(totalPatients / totalReports)
      : 0;
    const approvedReports = reports.filter(
      (r) => r.status === "Approved",
    ).length;
    const approvalRate = totalReports
      ? Math.round((approvedReports / totalReports) * 100)
      : 0;

    return NextResponse.json({
      dailyTrends,
      branchPerformance,
      patientCategories,
      recentReports,
      stats: {
        totalPatients,
        totalReports,
        averagePatients,
        approvalRate,
      },
      dateRange: {
        from: startDate,
        to: endDate,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error while fetching analytics data",
      },
      { status: 500 },
    );
  }
}
