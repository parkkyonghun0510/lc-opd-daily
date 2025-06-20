import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";

// Function to check database connection
async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "up",
      responseTime: 0, // You could measure this more precisely
    };
  } catch (error) {
    return {
      status: "down",
      responseTime: 0,
    };
  }
}

// Function to check storage status
async function checkStorageHealth() {
  try {
    // This is a placeholder. In a real app, you'd check actual storage metrics
    const totalStorage = 100 * 1024 * 1024 * 1024; // 100GB example
    const usedStorage = 30 * 1024 * 1024 * 1024; // 30GB example

    const usagePercentage = (usedStorage / totalStorage) * 100;

    return {
      status: usagePercentage > 90 ? "degraded" : "up",
      responseTime: 0,
    };
  } catch (error) {
    return {
      status: "down",
      responseTime: 0,
    };
  }
}

// Function to check Redis cache if you're using it
async function checkCacheHealth() {
  try {
    // This is a placeholder. In a real app, you'd check your cache service
    return {
      status: "up",
      responseTime: 0,
    };
  } catch (error) {
    return {
      status: "down",
      responseTime: 0,
    };
  }
}

// Function to check background jobs if you're using them
async function checkJobQueueHealth() {
  try {
    // This is a placeholder. In a real app, you'd check your job queue service
    return {
      status: "up",
      responseTime: 0,
    };
  } catch (error) {
    return {
      status: "down",
      responseTime: 0,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const token = await getToken({ req: request });
    if (!token || token.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 401 },
      );
    }

    // Check all services
    const [database, storage, cache, jobQueue] = await Promise.all([
      checkDatabaseHealth(),
      checkStorageHealth(),
      checkCacheHealth(),
      checkJobQueueHealth(),
    ]);

    // Determine overall system status
    const services = [
      { name: "Database", ...database },
      { name: "Storage", ...storage },
      { name: "Cache", ...cache },
      { name: "Job Queue", ...jobQueue },
    ];

    const downServices = services.filter((s) => s.status === "down");
    const degradedServices = services.filter((s) => s.status === "degraded");

    let status: "healthy" | "warning" | "critical";
    if (downServices.length > 0) {
      status = "critical";
    } else if (degradedServices.length > 0) {
      status = "warning";
    } else {
      status = "healthy";
    }

    return NextResponse.json({
      status,
      lastChecked: new Date(),
      services,
    });
  } catch (error) {
    console.error("Error checking system health:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
