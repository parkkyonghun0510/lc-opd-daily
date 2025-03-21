import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { redis } from "@/lib/redis";

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis connection
    await redis.set("health_check", "ok", { ex: 10 });
    const redisResult = await redis.get("health_check");

    if (redisResult !== "ok") {
      throw new Error("Redis health check failed");
    }

    return NextResponse.json(
      { status: "healthy", message: "All systems operational" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { status: "unhealthy", message: "System check failed" },
      { status: 500 }
    );
  }
}
