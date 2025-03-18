import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const preferencesSchema = z.object({
  type: z.enum(["notifications", "appearance"]),
  preferences: z.record(z.boolean()),
});

export async function PATCH(req: Request) {
  try {
    const token = await getToken({ req });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = preferencesSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentPreferences = user.preferences || {
      notifications: {
        reportUpdates: true,
        reportComments: true,
        reportApprovals: true,
      },
      appearance: {
        compactMode: false,
      },
    };

    const updatedPreferences = {
      ...currentPreferences,
      [validatedData.type]: {
        ...currentPreferences[validatedData.type],
        ...validatedData.preferences,
      },
    };

    const updatedUser = await prisma.user.update({
      where: { id: token.sub },
      data: {
        preferences: updatedPreferences,
      },
      select: {
        id: true,
        preferences: true,
      },
    });

    return NextResponse.json({
      message: "Preferences updated successfully",
      preferences: updatedUser.preferences,
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
