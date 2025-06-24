"use server";

import { getPrisma } from "@/lib/prisma-server";

interface ActivityMetadata {
  ipAddress: string;
  userAgent: string;
}

type ActivityDetails = Record<string, unknown>;

export async function logUserActivity(
  userId: string,
  action: string,
  details: ActivityDetails,
  metadata: ActivityMetadata,
) {
  try {
    const prisma = await getPrisma();
    await prisma.userActivity.create({
      data: {
        userId,
        action,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to log user activity:", error);
  }
}
