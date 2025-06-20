import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { z } from "zod";

const securityUpdateSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      ),
    confirmPassword: z.string(),
    isActive: z.boolean(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SecurityRouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = await getToken({ req: request });
    const { id } = await params;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    const isAdmin = token.role === UserRole.ADMIN;
    const isSelfUpdate = token.id === id;

    if (!isAdmin && !isSelfUpdate) {
      return NextResponse.json(
        { error: "Forbidden - You can only update your own security settings" },
        { status: 403 },
      );
    }

    const body = await request.json();

    const parseResult = securityUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const validatedData = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        password: true,
        isActive: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (
      user.role === UserRole.ADMIN &&
      !validatedData.isActive &&
      user.isActive
    ) {
      const adminCount = await prisma.user.count({
        where: {
          role: UserRole.ADMIN,
          isActive: true,
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot deactivate the last active admin user" },
          { status: 400 },
        );
      }
    }

    if (isSelfUpdate) {
      if (!validatedData.currentPassword) {
        return NextResponse.json(
          {
            fieldErrors: {
              currentPassword: [
                "Current password is required to change your own password",
              ],
            },
          },
          { status: 400 },
        );
      }

      const isValidPassword = await verifyPassword(
        validatedData.currentPassword,
        user.password,
      );

      if (!isValidPassword) {
        return NextResponse.json(
          {
            fieldErrors: { currentPassword: ["Current password is incorrect"] },
          },
          { status: 400 },
        );
      }

      if (validatedData.currentPassword === validatedData.newPassword) {
        return NextResponse.json(
          {
            fieldErrors: {
              newPassword: [
                "New password must be different from current password",
              ],
            },
          },
          { status: 400 },
        );
      }
    }

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
        { error: "Validation error", details: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
