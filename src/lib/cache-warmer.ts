import { getPrisma } from "@/lib/prisma-server";
import { redis, CACHE_TTL, CACHE_KEYS } from "./redis";

async function warmStatsCache() {
  try {
    console.log("🔄 Warming stats cache...");

    const prisma = await getPrisma();
    const stats = {
      totalUsers: await prisma.user.count({ where: { isActive: true } }),
      revenue: await getRevenue(),
      orders: await getOrders(),
      growth: await getGrowthRate(),
    };

    await redis.set(CACHE_KEYS.DASHBOARD_STATS, stats, {
      ex: CACHE_TTL.STATS,
    });

    console.log("✅ Stats cache warmed successfully");
  } catch (error) {
    console.error("❌ Error warming stats cache:", error);
  }
}

async function warmChartsCache() {
  try {
    console.log("🔄 Warming charts cache...");

    const prisma = await getPrisma();
    const chartData = {
      revenueData: await getRevenueData(),
      userGrowthData: await getUserGrowthData(),
    };

    await redis.set(CACHE_KEYS.DASHBOARD_CHARTS, chartData, {
      ex: CACHE_TTL.CHARTS,
    });

    console.log("✅ Charts cache warmed successfully");
  } catch (error) {
    console.error("❌ Error warming charts cache:", error);
  }
}

// Helper functions for data fetching
async function getRevenue() {
  const prisma = await getPrisma();
  const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
  const reports = await prisma.report.findMany({
    where: {
      date: {
        gte: thirtyDaysAgo.toISOString(),
      },
    },
    select: {
      writeOffs: true,
      ninetyPlus: true,
    },
  });

  return reports.reduce(
    (sum, report) => sum + report.writeOffs + report.ninetyPlus,
    0
  );
}

async function getOrders() {
  const prisma = await getPrisma();
  const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
  return await prisma.report.count({
    where: {
      date: {
        gte: thirtyDaysAgo.toISOString(),
      },
    },
  });
}

async function getGrowthRate() {
  const prisma = await getPrisma();
  const currentMonthStart = new Date(new Date().setDate(1));
  const lastMonthStart = new Date(
    new Date().setMonth(new Date().getMonth() - 1, 1)
  );
  const currentMonth = await prisma.report.aggregate({
    where: {
      date: {
        gte: currentMonthStart.toISOString(),
      },
    },
    _sum: {
      writeOffs: true,
      ninetyPlus: true,
    },
  });

  const lastMonth = await prisma.report.aggregate({
    where: {
      date: {
        gte: lastMonthStart.toISOString(),
        lt: currentMonthStart.toISOString(),
      },
    },
    _sum: {
      writeOffs: true,
      ninetyPlus: true,
    },
  });

  const currentTotal =
    (currentMonth._sum.writeOffs || 0) + (currentMonth._sum.ninetyPlus || 0);
  const lastTotal =
    (lastMonth._sum.writeOffs || 0) + (lastMonth._sum.ninetyPlus || 0);

  if (lastTotal === 0) return 0;
  return Math.round(((currentTotal - lastTotal) / lastTotal) * 100);
}

async function getRevenueData() {
  const prisma = await getPrisma();
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
    const value = (report._sum.writeOffs || 0) + (report._sum.ninetyPlus || 0);

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
  const prisma = await getPrisma();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const formattedDate = sixMonthsAgo.toISOString(); // Keep full ISO string for DateTime fields

  const userCounts = await prisma.user.groupBy({
    by: ["createdAt"],
    where: {
      createdAt: {
        gte: formattedDate,
      },
    },
    _count: {
      id: true,
    },
  });

  const monthlyData = userCounts.reduce((acc, data) => {
    const month = data.createdAt.toLocaleString("default", { month: "short" });

    if (!acc[month]) {
      acc[month] = 0;
    }
    acc[month] += data._count.id;
    return acc;
  }, {} as Record<string, number>);

  let cumulative = 0;
  return Object.entries(monthlyData).map(([date, count]) => {
    cumulative += count;
    return {
      date,
      value: cumulative,
    };
  });
}

export async function warmCache() {
  console.log("🚀 Starting cache warming...");
  const prisma = await getPrisma();
  await Promise.all([warmStatsCache(), warmChartsCache()]);
  console.log("✨ Cache warming completed");
}

export { warmChartsCache };
