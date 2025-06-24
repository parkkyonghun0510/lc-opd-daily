import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { Permission, UserRole, hasPermission } from "@/lib/auth/roles";

// Define a type for Decimal values from Prisma
type PrismaDecimal =
  | { toString(): string }
  | number
  | string
  | null
  | undefined;

// Helper function to convert Decimal to number
const toNumber = (value: PrismaDecimal): number => {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  if (typeof value === "object" && "toString" in value)
    return Number(value.toString()) || 0;
  return Number(value) || 0;
};

// GET /api/dashboard/data - Get dashboard data
export async function GET(request: NextRequest) {
  //console.log("[Dashboard API] Received request at:", new Date().toISOString());
  try {
    // Authenticate user
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Get user's branch ID from token
    const branchId = token.branchId as string | null;
    const userRole = token.role as UserRole;

    // Base query conditions
    const baseConditions =
      userRole === "ADMIN" ? {} : { branchId: branchId || "" };

    // Fetch total users
    const totalUsers = await prisma.user.count({
      where: baseConditions,
    });

    // Create date for 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    // Fetch total reports
    const totalReports = await prisma.report.count({
      where: {
        ...baseConditions,
        date: {
          gte: thirtyDaysAgoStr, // Last 30 days
        },
      },
    });

    // Calculate total amounts (writeOffs + ninetyPlus)
    const revenueData = await prisma.report.aggregate({
      where: {
        ...baseConditions,
        status: "approved",
        reportType: "actual",
        date: {
          gte: thirtyDaysAgoStr, // Last 30 days
        },
      },
      _sum: {
        writeOffs: true,
        ninetyPlus: true,
      },
    });

    const writeOffs = toNumber(revenueData._sum?.writeOffs || 0);
    const ninetyPlus = toNumber(revenueData._sum?.ninetyPlus || 0);
    const totalAmount = writeOffs + ninetyPlus;

    // Calculate growth rate (comparing current month with previous month)
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const currentMonthStartStr = currentMonthStart.toISOString();

    const previousMonthStart = new Date(currentMonthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    const previousMonthStartStr = previousMonthStart.toISOString();

    const currentMonthData = await prisma.report.aggregate({
      where: {
        ...baseConditions,
        status: "approved",
        date: {
          gte: currentMonthStartStr,
        },
      },
      _sum: {
        writeOffs: true,
        ninetyPlus: true,
      },
    });

    const previousMonthData = await prisma.report.aggregate({
      where: {
        ...baseConditions,
        status: "approved",
        date: {
          gte: previousMonthStartStr,
          lt: currentMonthStartStr,
        },
      },
      _sum: {
        writeOffs: true,
        ninetyPlus: true,
      },
    });

    const currentAmount =
      toNumber(currentMonthData._sum?.writeOffs || 0) +
      toNumber(currentMonthData._sum?.ninetyPlus || 0);
    const previousAmount =
      toNumber(previousMonthData._sum?.writeOffs || 0) +
      toNumber(previousMonthData._sum?.ninetyPlus || 0);
    const growthRate =
      previousAmount === 0
        ? 100
        : ((currentAmount - previousAmount) / previousAmount) * 100;

    const responseData = {
      data: {
        totalUsers,
        totalReports,
        totalAmount,
        growthRate: Math.round(growthRate * 100) / 100, // Round to 2 decimal places
      },
    };

    //console.log("[Dashboard API] Sending response:", JSON.stringify(responseData, null, 2));

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 },
    );
  }
}
