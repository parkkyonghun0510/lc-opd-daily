import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const preferencesSchema = z.object({
  type: z.enum(["notifications", "appearance"]),
  preferences: z.record(z.boolean()),
});

export async function PATCH(req: NextRequest) {
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

    const defaultPreferences = {
      notifications: {
        reportUpdates: true,
        reportComments: true,
        reportApprovals: true,
      },
      appearance: {
        compactMode: false,
      },
    };

    // Convert the preferences to a plain object
    const currentPreferences = JSON.parse(
      JSON.stringify(user.preferences || defaultPreferences),
    );

    // Update the preferences
    currentPreferences[validatedData.type] = {
      ...currentPreferences[validatedData.type],
      ...validatedData.preferences,
    };

    const updatedUser = await prisma.user.update({
      where: { id: token.sub },
      data: {
        preferences: currentPreferences,
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
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
