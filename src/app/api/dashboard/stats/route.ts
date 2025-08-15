import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { redis, CACHE_TTL, CACHE_KEYS } from "@/lib/redis";
import { recordCacheHit, recordCacheMiss } from "@/lib/cache-monitor";
import { Permission, UserRole, hasPermission } from "@/lib/auth/roles";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { SessionUser } from "@/lib/auth/index";
import { headers } from "next/headers";

const prisma = new PrismaClient();

// Helper function to convert Decimal to number
const toNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  return Number(value) || 0;
};

// Configure route to be dynamic
export const dynamic = 'force-dynamic';

// Remove revalidate since we're using dynamic data
// export const revalidate = 300;

export async function GET() {
  // Get headers for dynamic usage
  const headersList = headers();

  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse(null, { status: 401 });
    }

    const user = session.user as SessionUser;

    // Check permissions
    if (!hasPermission(user.role as UserRole, Permission.VIEW_DASHBOARD)) {
      return new NextResponse(null, { status: 403 });
    }

    // Try to get data from Redis cache first
    const cacheKey = `${CACHE_KEYS.DASHBOARD_STATS}:${user.branchId || "all"}`;
    const cachedStats = await redis.get(cacheKey);
    if (cachedStats && typeof cachedStats === 'string') {
      await recordCacheHit(cacheKey);
      return NextResponse.json(JSON.parse(cachedStats));
    }

    await recordCacheMiss(cacheKey);

    // If no cache, fetch fresh data
    const stats = {
      totalUsers: await getTotalUsers(user),
      revenue: await getRevenue(user),
      orders: await getOrders(user),
      growth: await getGrowthRate(user),
    };

    // Store in Redis cache
    await redis.set(cacheKey, JSON.stringify(stats), 'EX', CACHE_TTL.STATS);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
}

async function getTotalUsers(user: SessionUser) {
  const where =
    user.role !== UserRole.ADMIN && user.branchId
      ? { isActive: true, branchId: user.branchId }
      : { isActive: true };

  return await prisma.user.count({ where });
}

async function getRevenue(user: SessionUser) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const where = {
    date: {
      gte: thirtyDaysAgo.toISOString(),
    },
    ...(user.role !== UserRole.ADMIN && user.branchId
      ? { branchId: user.branchId }
      : {}),
  };

  const reports = await prisma.report.findMany({
    where,
    select: {
      writeOffs: true,
      ninetyPlus: true,
    },
  });

  return reports.reduce(
    (sum, report) => sum + toNumber(report.writeOffs) + toNumber(report.ninetyPlus),
    0
  );
}

async function getOrders(user: SessionUser) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const where = {
    date: {
      gte: thirtyDaysAgo.toISOString(),
    },
    ...(user.role !== UserRole.ADMIN && user.branchId
      ? { branchId: user.branchId }
      : {}),
  };

  return await prisma.report.count({ where });
}

async function getGrowthRate(user: SessionUser) {
  const whereBase =
    user.role !== UserRole.ADMIN && user.branchId
      ? { branchId: user.branchId }
      : {};

  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);

  const lastMonthStart = new Date();
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1, 1);

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);

  const currentMonth = await prisma.report.aggregate({
    where: {
      date: {
        gte: currentMonthStart.toISOString(),
      },
      ...whereBase,
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
        lt: thisMonthStart.toISOString(),
      },
      ...whereBase,
    },
    _sum: {
      writeOffs: true,
      ninetyPlus: true,
    },
  });

  const currentTotal =
    (toNumber(currentMonth._sum?.writeOffs ?? 0) + toNumber(currentMonth._sum?.ninetyPlus ?? 0));
  const lastTotal =
    (toNumber(lastMonth._sum?.writeOffs ?? 0) + toNumber(lastMonth._sum?.ninetyPlus ?? 0));

  if (lastTotal === 0) return 0;
  return Math.round(((currentTotal - lastTotal) / lastTotal) * 100);
}
