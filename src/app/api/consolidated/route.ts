import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

// Validation schema for date parameter
const dateSchema = z.string().datetime();

interface DailyTotal {
  date: string;
  writeOffs: number;
  ninetyPlus: number;
}

interface WeeklyTotal {
  week: string;
  writeOffs: number;
  ninetyPlus: number;
}

// GET /api/consolidated - Get consolidated report by date
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const includeInactive = searchParams.get("includeInactive") === "true";
  const viewType = searchParams.get("viewType") || "daily"; // Default to daily view

  try {
    // Validate date parameter
    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    console.log("API received date parameter:", date);

    // Parse the date more safely
    let dateObj;
    try {
      const validatedDate = dateSchema.parse(date);
      dateObj = new Date(validatedDate);

      if (isNaN(dateObj.getTime())) {
        throw new Error("Invalid date");
      }

      console.log("Parsed date object:", dateObj);
    } catch (error) {
      console.error("Date validation error:", error);
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Create start and end dates for the query based on view type
    let startDate, endDate;
    
    if (viewType === "daily") {
      // Daily view - just use the selected date
      startDate = new Date(dateObj);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(dateObj);
      endDate.setHours(23, 59, 59, 999);
    } else if (viewType === "weekly") {
      // Weekly view - start from the selected date and include 7 days
      startDate = new Date(dateObj);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(dateObj);
      endDate.setDate(endDate.getDate() + 6); // 7 days total (including start date)
      endDate.setHours(23, 59, 59, 999);
    } else if (viewType === "monthly") {
      // Monthly view - start from the 1st of the month and go to the last day
      startDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0); // Last day of the month
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default to daily view if invalid view type
      startDate = new Date(dateObj);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(dateObj);
      endDate.setHours(23, 59, 59, 999);
    }

    console.log(`Query date range for ${viewType} view:`, { startDate, endDate });

    // Format dates to ISO string for Prisma
    const startDateFormatted = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const endDateFormatted = endDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // Get all branches
    const branches = await prisma.branch.findMany({
      where: {
        isActive: includeInactive ? undefined : true,
      },
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });

    console.log(`Found ${branches.length} branches`);

    // Get reports for the specified date
    const reports = await prisma.report.findMany({
      where: {
        date: {
          gte: startDateFormatted,
          lt: endDateFormatted,
        },
      },
      include: {
        branch: true,
      },
    });

    console.log(`Found ${reports.length} reports for the date`);

    // Calculate totals and prepare branch data
    let totalWriteOffs = 0;
    let totalNinetyPlus = 0;
    const reportedBranchIds = new Set();
    const branchData = [];

    // Process each branch
    for (const branch of branches) {
      const report = reports.find((r) => r.branchId === branch.id);
      const branchWriteOffs = report ? report.writeOffs : 0;
      const branchNinetyPlus = report ? report.ninetyPlus : 0;

      totalWriteOffs += branchWriteOffs;
      totalNinetyPlus += branchNinetyPlus;

      if (report) {
        reportedBranchIds.add(branch.id);
      }

      branchData.push({
        branch: branch.code,
        branchName: branch.name,
        isActive: branch.isActive,
        writeOffs: branchWriteOffs,
        ninetyPlus: branchNinetyPlus,
        reported: reportedBranchIds.has(branch.id),
        reportStatus: report?.status || "missing",
        submittedAt: report?.submittedAt,
        submittedBy: report?.submittedBy,
      });
    }

    // Calculate statistics
    const statistics = {
      totalWriteOffs,
      totalNinetyPlus,
      reportedBranches: reportedBranchIds.size,
      totalBranches: branches.length,
      missingBranches: branches.length - reportedBranchIds.size,
      averageWriteOffs:
        reportedBranchIds.size > 0
          ? totalWriteOffs / reportedBranchIds.size
          : 0,
      averageNinetyPlus:
        reportedBranchIds.size > 0
          ? totalNinetyPlus / reportedBranchIds.size
          : 0,
    };

    // Get previous day's data for comparison
    const previousDate = new Date(dateObj);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateFormatted = previousDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const previousReports = await prisma.report.findMany({
      where: {
        date: previousDateFormatted,
      },
    });

    const previousTotals = previousReports.reduce(
      (acc, report) => ({
        writeOffs: acc.writeOffs + report.writeOffs,
        ninetyPlus: acc.ninetyPlus + report.ninetyPlus,
      }),
      { writeOffs: 0, ninetyPlus: 0 }
    );

    // Generate time series data for weekly and monthly views
    let dailyTotals: DailyTotal[] = [];
    let weeklyTotals: WeeklyTotal[] = [];
    
    if (viewType === "weekly") {
      // For weekly view, get daily totals
      const dailyReportsPromises = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const currentDateFormatted = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
        
        dailyReportsPromises.push(
          prisma.report.findMany({
            where: {
              date: currentDateFormatted,
            },
          })
        );
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      const dailyReportsResults = await Promise.all(dailyReportsPromises);
      
      dailyTotals = dailyReportsResults.map((dayReports, index) => {
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + index);
        
        const dayTotals = dayReports.reduce(
          (acc, report) => ({
            writeOffs: acc.writeOffs + report.writeOffs,
            ninetyPlus: acc.ninetyPlus + report.ninetyPlus,
          }),
          { writeOffs: 0, ninetyPlus: 0 }
        );
        
        return {
          date: dayDate.toISOString().split('T')[0],
          writeOffs: dayTotals.writeOffs,
          ninetyPlus: dayTotals.ninetyPlus,
        };
      });
    } else if (viewType === "monthly") {
      // For monthly view, get weekly totals
      const weeksInMonth = Math.ceil(endDate.getDate() / 7);
      
      for (let weekNum = 0; weekNum < weeksInMonth; weekNum++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(weekStart.getDate() + (weekNum * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        // Ensure we don't go beyond the month
        if (weekEnd > endDate) {
          weekEnd.setTime(endDate.getTime());
        }

        const weekStartFormatted = weekStart.toISOString().split('T')[0]; // YYYY-MM-DD
        const weekEndFormatted = weekEnd.toISOString().split('T')[0]; // YYYY-MM-DD
        
        const weekReports = await prisma.report.findMany({
          where: {
            date: {
              gte: weekStartFormatted,
              lt: weekEndFormatted,
            },
          },
        });
        
        const weekTotals = weekReports.reduce(
          (acc, report) => ({
            writeOffs: acc.writeOffs + report.writeOffs,
            ninetyPlus: acc.ninetyPlus + report.ninetyPlus,
          }),
          { writeOffs: 0, ninetyPlus: 0 }
        );
        
        weeklyTotals.push({
          week: `Week ${weekNum + 1}`,
          writeOffs: weekTotals.writeOffs,
          ninetyPlus: weekTotals.ninetyPlus,
        });
      }
    }
    
    const consolidatedData = {
      date: date,
      statistics,
      branches: branchData,
      comparison: {
        previousDate: previousDate.toISOString(),
        writeOffsChange: previousTotals.writeOffs
          ? ((totalWriteOffs - previousTotals.writeOffs) /
              previousTotals.writeOffs) *
            100
          : 0,
        ninetyPlusChange: previousTotals.ninetyPlus
          ? ((totalNinetyPlus - previousTotals.ninetyPlus) /
              previousTotals.ninetyPlus) *
            100
          : 0,
      },
      // Add view-specific data
      ...(viewType === "weekly" && { dailyTotals }),
      ...(viewType === "monthly" && { weeklyTotals }),
      // Add date range information for weekly and monthly views
      ...(viewType === "weekly" && { 
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }),
      ...(viewType === "monthly" && { 
        month: `${dateObj.toLocaleString('default', { month: 'long' })} ${dateObj.getFullYear()}`
      }),
    };

    return NextResponse.json(consolidatedData);
  } catch (error: unknown) {
    console.error("Error generating consolidated report:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid date format", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate consolidated report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST /api/consolidated/notify - Send consolidated report notification
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date } = body;

    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    const validatedDate = dateSchema.parse(date);
    const dateObj = new Date(validatedDate);
    const formattedDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

    // Get consolidated data
    const consolidatedData = await prisma.report.findMany({
      where: {
        date: formattedDate,
      },
      include: {
        branch: true,
      },
    });

    // Calculate totals
    const totals = consolidatedData.reduce(
      (acc, report) => ({
        writeOffs: acc.writeOffs + report.writeOffs,
        ninetyPlus: acc.ninetyPlus + report.ninetyPlus,
      }),
      { writeOffs: 0, ninetyPlus: 0 }
    );

    // TODO: Send Telegram notification with consolidated data

    return NextResponse.json({
      success: true,
      message: "Consolidated report notification sent",
      data: {
        date: validatedDate,
        totalReports: consolidatedData.length,
        totals,
      },
    });
  } catch (error: unknown) {
    console.error("Error sending consolidated report notification:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid date format", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to send consolidated report notification",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
