import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { z } from "zod";

const securityUpdateSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  confirmPassword: z.string(),
  isActive: z.boolean(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: "New password must be different from current password",
  path: ["newPassword"],
});

export async function PATCH(
  request: NextRequest
) {
  try {
    const token = await getToken({ req: request });
    
    // Extract the ID from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 2]; // Get the ID from the URL path

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Only admin can update other users' security settings
    if (token.role !== UserRole.ADMIN && token.id !== id) {
      return NextResponse.json(
        { error: "Forbidden - You can only update your own security settings" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = securityUpdateSchema.parse(body);

    // Get the user
    const user = await prisma.user.findUnique({
      where: { id },
      select: { 
        password: true,
        isActive: true,
        role: true 
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Prevent deactivating the last admin user
    if (user.role === UserRole.ADMIN && !validatedData.isActive) {
      const adminCount = await prisma.user.count({
        where: { 
          role: UserRole.ADMIN,
          isActive: true 
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot deactivate the last active admin user" },
          { status: 400 }
        );
      }
    }

    // Verify current password if user is updating their own settings
    if (token.id === id) {
      const isValidPassword = await verifyPassword(
        validatedData.currentPassword,
        user.password
      );

      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }
    }

    // Update user security settings
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        password: await hashPassword(validatedData.newPassword),
        isActive: validatedData.isActive,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user security settings:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 