import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "This endpoint is only available in development" },
        { status: 403 }
      );
    }

    // Verify admin access
    const token = await getToken({ req: request });
    if (!token || token.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const hashedPassword = await hashPassword("Test@123");

    // Create test users for each role
    const users = await Promise.all([
      prisma.user.create({
        data: {
          username: "test_regular",
          email: "test_regular@example.com",
          name: "Test Regular User",
          password: hashedPassword,
          role: "user",
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          username: "test_readonly",
          email: "test_readonly@example.com",
          name: "Test Read Only User",
          password: hashedPassword,
          role: "readonly",
          isActive: true,
        },
      }),
    ]);

    return NextResponse.json({
      message: "Test users created successfully",
      users: users.map((u) => ({
        username: u.username,
        role: u.role,
      })),
    });
  } catch (error) {
    console.error("Error creating test users:", error);
    return NextResponse.json(
      { error: "Failed to create test users" },
      { status: 500 }
    );
  }
}
