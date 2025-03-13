import { NextRequest, NextResponse } from "next/server";
import { withAuth, Role } from "@/lib/api-auth";
import { JWT } from "next-auth/jwt";
import prisma from "../../../../lib/prisma";

interface AuthToken extends JWT {
  role: Role;
  branchId: string | null;
}

async function handler(req: NextRequest, token: AuthToken) {
  try {
    // Get user's branch ID from token
    const branchId = token.branchId;
    const userRole = token.role;

    // Base query conditions
    const baseConditions =
      userRole === "admin" ? {} : { branchId: branchId || "" };

    // Fetch total users
    const totalUsers = await prisma.user.count({
      where: baseConditions,
    });

    // Fetch total reports
    const totalReports = await prisma.report.count({
      where: {
        ...baseConditions,
        date: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
        },
      },
    });

    // Calculate total amounts (writeOffs + ninetyPlus)
    const revenueData = await prisma.report.aggregate({
      where: {
        ...baseConditions,
        status: "approved",
        date: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
        },
      },
      _sum: {
        writeOffs: true,
        ninetyPlus: true,
      },
    });

    const writeOffs = revenueData._sum?.writeOffs || 0;
    const ninetyPlus = revenueData._sum?.ninetyPlus || 0;
    const totalAmount = writeOffs + ninetyPlus;

    // Calculate growth rate (comparing current month with previous month)
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const previousMonthStart = new Date(currentMonthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

    const currentMonthData = await prisma.report.aggregate({
      where: {
        ...baseConditions,
        status: "approved",
        date: {
          gte: currentMonthStart,
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
          gte: previousMonthStart,
          lt: currentMonthStart,
        },
      },
      _sum: {
        writeOffs: true,
        ninetyPlus: true,
      },
    });

    const currentAmount =
      (currentMonthData._sum?.writeOffs || 0) +
      (currentMonthData._sum?.ninetyPlus || 0);
    const previousAmount =
      (previousMonthData._sum?.writeOffs || 0) +
      (previousMonthData._sum?.ninetyPlus || 0);
    const growthRate =
      previousAmount === 0
        ? 100
        : ((currentAmount - previousAmount) / previousAmount) * 100;

    return NextResponse.json({
      data: {
        totalUsers,
        totalReports,
        totalAmount,
        growthRate: Math.round(growthRate * 100) / 100, // Round to 2 decimal places
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler, {
  requiredRole: ["admin", "manager", "user"],
});
