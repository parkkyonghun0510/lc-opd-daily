import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";
import { z } from "zod";

// Schema for validating user profile update
const profileUpdateSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  branchId: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    // Extract the ID from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const userId = pathParts[pathParts.length - 2]; // Get the ID from the URL path

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Only allow admins to update other users' profiles
    if (token.role !== UserRole.ADMIN && token.id !== userId) {
      return NextResponse.json(
        { error: "Forbidden - You can only update your own profile" },
        { status: 403 },
      );
    }

    // Validate the request body
    const body = await request.json();
    let validatedData;

    try {
      validatedData = profileUpdateSchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: "Invalid data",
            details: validationError.errors.map((err) => ({
              field: err.path.join("."),
              message: err.message,
            })),
          },
          { status: 400 },
        );
      }
      throw validationError;
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if username and email are unique (excluding the current user)
    if (validatedData.username !== existingUser.username) {
      const usernameExists = await prisma.user.findFirst({
        where: {
          username: validatedData.username,
          NOT: { id: userId },
        },
      });

      if (usernameExists) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 },
        );
      }
    }

    if (validatedData.email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: validatedData.email,
          NOT: { id: userId },
        },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: "Email is already registered" },
          { status: 409 },
        );
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        username: validatedData.username,
        name: validatedData.name,
        email: validatedData.email,
        branchId: validatedData.branchId,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true,
        branch: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
