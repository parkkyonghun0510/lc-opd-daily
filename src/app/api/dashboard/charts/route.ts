import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { redis, CACHE_TTL, CACHE_KEYS } from "@/lib/redis";
import { recordCacheHit, recordCacheMiss } from "@/lib/cache-monitor";

const prisma = new PrismaClient();

export const revalidate = 900; // Revalidate every 15 minutes for Next.js cache

export async function GET() {
  try {
    // Try to get data from Redis cache first
    const cachedChartData = await redis.get(CACHE_KEYS.DASHBOARD_CHARTS);
    if (cachedChartData) {
      await recordCacheHit(CACHE_KEYS.DASHBOARD_CHARTS);
      return NextResponse.json(cachedChartData);
    }

    await recordCacheMiss(CACHE_KEYS.DASHBOARD_CHARTS);

    // If no cache, fetch fresh data
    const chartData = {
      revenueData: await getRevenueData(),
      userGrowthData: await getUserGrowthData(),
    };

    // Store in Redis cache
    await redis.set(CACHE_KEYS.DASHBOARD_CHARTS, chartData, {
      ex: CACHE_TTL.CHARTS,
    });

    return NextResponse.json(chartData);
  } catch (error) {
    console.error("Error fetching chart data:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}

async function getRevenueData() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const formattedDate = sixMonthsAgo.toISOString().split("T")[0]; // Format as YYYY-MM-DD

  const reports = await prisma.report.groupBy({
    by: ["date"],
    where: {
      date: {
        gte: formattedDate, // Use formatted string date
      },
    },
    _sum: {
      writeOffs: true,
      ninetyPlus: true,
    },
  });

  const monthlyData = reports.reduce((acc, report) => {
    const month = new Date(report.date).toLocaleString("default", {
      month: "short",
    });
    const value =
      (report._sum?.writeOffs || 0) + (report._sum?.ninetyPlus || 0);

    if (!acc[month]) {
      acc[month] = 0;
    }
    acc[month] += value;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(monthlyData).map(([date, value]) => ({
    date,
    value: Math.round(value),
  }));
}

async function getUserGrowthData() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const userCounts = await prisma.user.groupBy({
    by: ["createdAt"],
    where: {
      createdAt: {
        gte: sixMonthsAgo, // This is fine because createdAt is DateTime in schema
      },
    },
    _count: {
      id: true,
    },
  });

  // Process and format the data
  const monthlyData = userCounts.reduce((acc, data) => {
    const month = data.createdAt.toLocaleString("default", { month: "short" });

    if (!acc[month]) {
      acc[month] = 0;
    }
    acc[month] += data._count.id;
    return acc;
  }, {} as Record<string, number>);

  // Convert to array format and calculate cumulative growth
  let cumulative = 0;
  return Object.entries(monthlyData).map(([date, count]) => {
    cumulative += count;
    return {
      date,
      value: cumulative,
    };
  });
}
