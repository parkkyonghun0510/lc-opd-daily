import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma-server";
import { initializeApplication } from "@/lib/initializer";

/**
 * Health check endpoint for monitoring
 * Returns system status information
 */
export async function GET() {
  try {
    // Check database and run application initialization in parallel
    const prisma = await getPrisma();
    const [_, initResult] = await Promise.all([
      prisma.$queryRaw`SELECT 1` ,
      initializeApplication(false),
    ]);

    const status = initResult.success ? 200 : 500;

    const health = {
      status: initResult.success ? "ok" : "error",
      timestamp: new Date().toISOString(),
      services: {
        database: "connected",
        api: "running",
        environment: initResult.services.environment,
        redis: initResult.services.redis,
        dragonfly: initResult.services.dragonfly,
        vapid: initResult.services.vapid,
      },
      errors: initResult.errors,
      warnings: initResult.warnings,
      version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    } as const;

    return NextResponse.json(health, { status });
  } catch (error) {
    console.error("Health check failed:", error);

    const health = {
      status: "error",
      timestamp: new Date().toISOString(),
      services: {
        database: error instanceof Error ? error.message : "unknown error",
        api: "running",
      },
      version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    } as const;

    return NextResponse.json(health, { status: 500 });
  }
}
