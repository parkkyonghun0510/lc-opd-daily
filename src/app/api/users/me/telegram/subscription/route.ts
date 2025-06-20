import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

// GET /api/users/me/telegram/subscription
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token?.sub) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }
    const userId = token.sub;

    const subscription = await prisma.telegramSubscription.findUnique({
      where: { userId },
      select: {
        id: true,
        chatId: true, // Maybe useful for display, maybe not
        username: true,
        createdAt: true,
      },
    });

    if (!subscription) {
      return NextResponse.json({ linked: false });
    }

    return NextResponse.json({ linked: true, subscription });
  } catch (error) {
    console.error("Error fetching Telegram subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/users/me/telegram/subscription
export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token?.sub) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }
    const userId = token.sub;

    // Check if subscription exists before deleting
    const existingSub = await prisma.telegramSubscription.findUnique({
      where: { userId },
    });

    if (!existingSub) {
      return NextResponse.json(
        { error: "Telegram subscription not found." },
        { status: 404 },
      );
    }

    // Delete the subscription
    await prisma.telegramSubscription.delete({
      where: { userId },
    });

    return NextResponse.json({
      success: true,
      message: "Telegram subscription unlinked successfully.",
    });
  } catch (error) {
    console.error("Error deleting Telegram subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
