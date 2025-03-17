import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getPrisma } from "@/lib/prisma-server";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
});

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    let validatedData;

    try {
      validatedData = profileSchema.parse(body);
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
          { status: 400 }
        );
      }
      throw validationError;
    }

    const prisma = await getPrisma();

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: validatedData.email,
        NOT: {
          id: token.sub,
        },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: token.sub },
      data: {
        name: validatedData.name,
        email: validatedData.email,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
      },
    });

    return NextResponse.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
