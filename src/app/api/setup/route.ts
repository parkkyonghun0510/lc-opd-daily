import { NextResponse } from "next/server";
import { PrismaClient, Branch } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { logUserActivity } from "@/lib/auth/log-user-activity";

const prisma = new PrismaClient();

// Setup secret key to prevent unauthorized setup
// This should be set in env variables in production
const SETUP_SECRET_KEY = process.env.SETUP_SECRET_KEY || "setup-secret-key";

// Default branches for initial setup
const DEFAULT_BRANCHES = [
  { code: "HQ", name: "Headquarters", isActive: true },
  { code: "BR01", name: "Branch 01", isActive: true },
  { code: "BR02", name: "Branch 02", isActive: true },
];

// Check if system is already set up
export async function GET() {
  try {
    // Check if any users exist
    const userCount = await prisma.user.count();
    const isSetup = userCount > 0;

    // Check if any branches exist
    const branchCount = await prisma.branch.count();

    return NextResponse.json({
      isSetup,
      userCount,
      branchCount,
    });
  } catch (error) {
    console.error("Error checking setup status:", error);
    return NextResponse.json(
      { error: "Failed to check setup status" },
      { status: 500 }
    );
  }
}

// Set up the system with initial data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      adminUsername,
      adminName,
      adminEmail,
      adminPassword,
      secretKey,
      createDefaultBranches = true,
    } = body;

    // Validate secret key
    if (secretKey !== SETUP_SECRET_KEY) {
      return NextResponse.json(
        { error: "Invalid setup secret key" },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!adminUsername || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: "All admin user fields are required" },
        { status: 400 }
      );
    }

    // Check if system is already set up
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        { error: "System is already set up" },
        { status: 400 }
      );
    }

    // Create default branches if requested
    let branches: Branch[] = [];
    if (createDefaultBranches) {
      branches = await Promise.all(
        DEFAULT_BRANCHES.map((branch) =>
          prisma.branch.create({
            data: branch,
          })
        )
      );
    }

    // Get the HQ branch ID for admin user
    const hqBranch = branches.find((branch) => branch.code === "HQ");
    const branchId = hqBranch?.id;

    // Hash admin password
    const hashedPassword = await hashPassword(adminPassword);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        username: adminUsername,
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        branchId,
        isActive: true,
      },
    });

    // Log the setup activity
    await logUserActivity(
      adminUser.id,
      "SYSTEM_SETUP",
      {
        createdBranches: branches.length,
        adminUsername: adminUsername,
      },
      {
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      }
    );

    return NextResponse.json({
      success: true,
      message: "System setup completed successfully",
      adminUser: {
        id: adminUser.id,
        username: adminUser.username,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
      branches: branches.map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
      })),
    });
  } catch (error) {
    console.error("Error during system setup:", error);
    return NextResponse.json(
      {
        error: "Failed to set up system",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
