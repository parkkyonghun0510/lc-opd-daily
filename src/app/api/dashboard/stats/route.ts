import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { redis, CACHE_TTL, CACHE_KEYS } from "@/lib/redis";
import { recordCacheHit, recordCacheMiss } from "@/lib/cache-monitor";
import { Permission, UserRole, hasPermission } from "@/lib/auth/roles";
import { getServerSession } from "next-auth";
import { authOptions, SessionUser } from "@/lib/auth";

const prisma = new PrismaClient();

export const revalidate = 300; // Revalidate every 5 minutes for Next.js cache

export async function GET() {
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
    if (cachedStats) {
      await recordCacheHit(cacheKey);
      return NextResponse.json(cachedStats);
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
    await redis.set(cacheKey, stats, {
      ex: CACHE_TTL.STATS,
    });

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
  const where = {
    date: {
      gte: new Date(new Date().setDate(new Date().getDate() - 30)),
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
    (sum, report) => sum + report.writeOffs + report.ninetyPlus,
    0
  );
}

async function getOrders(user: SessionUser) {
  const where = {
    date: {
      gte: new Date(new Date().setDate(new Date().getDate() - 30)),
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

  const currentMonth = await prisma.report.aggregate({
    where: {
      date: {
        gte: new Date(new Date().setDate(1)),
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
        gte: new Date(new Date().setMonth(new Date().getMonth() - 1, 1)),
        lt: new Date(new Date().setDate(1)),
      },
      ...whereBase,
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
