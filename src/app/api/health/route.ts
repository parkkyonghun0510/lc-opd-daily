import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma-server";

/**
 * Health check endpoint for monitoring
 * Returns system status information
 */
export async function GET() {
  try {
    // Check database connection
    const prisma = await getPrisma();
    await prisma.$queryRaw`SELECT 1`;

    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        database: "connected",
        api: "running",
      },
      version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    console.error("Health check failed:", error);

    const health = {
      status: "error",
      timestamp: new Date().toISOString(),
      services: {
        database: error instanceof Error ? error.message : "unknown error",
        api: "running",
      },
    };

    return NextResponse.json(health, { status: 500 });
  }
}
