import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";
import { sendToNotificationQueue } from "@/lib/queue/sqs";
import { NotificationType } from "@/utils/notificationTemplates";
import { z } from "zod";

const systemUpdateSchema = z.object({
  title: z.string().optional().default("System Update"),
  message: z.string().min(1, "Message cannot be empty"),
});

// POST /api/admin/system-update
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    // 1. Authorization: Only Admins can send system updates
    if (!token || token.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - Admin permission required" },
        { status: 403 },
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const parseResult = systemUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.flatten() },
        { status: 400 },
      );
    }
    const { title, message } = parseResult.data;

    // 3. Get all active user IDs
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const activeUserIds = activeUsers.map((user) => user.id);

    // 4. Queue the notification
    if (activeUserIds.length > 0) {
      try {
        await sendToNotificationQueue({
          type: NotificationType.SYSTEM_NOTIFICATION, // Use a specific type
          data: {
            title,
            body: message, // Use 'body' consistently with worker
            senderName: token.name || "Admin", // Optionally include sender
          },
          userIds: activeUserIds,
          priority: "high", // System updates might be high priority
        });

        return NextResponse.json({
          success: true,
          message: `System update notification queued for ${activeUserIds.length} active users.`,
        });
      } catch (queueError) {
        console.error("Error sending system update to SQS queue:", queueError);
        // Optional: Implement fallback to direct DB notification if critical
        return NextResponse.json(
          { error: "Failed to queue notification" },
          { status: 500 },
        );
      }
    } else {
      return NextResponse.json(
        { success: true, message: "No active users found to notify." },
        { status: 200 },
      );
    }
  } catch (error) {
    console.error("Error in system update API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
