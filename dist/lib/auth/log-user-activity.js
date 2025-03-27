"use server";
import { getPrisma } from "@/lib/prisma-server";
export async function logUserActivity(userId, action, details, metadata) {
    try {
        const prisma = await getPrisma();
        await prisma.userActivity.create({
            data: {
                userId,
                action,
                details,
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
            },
        });
    }
    catch (error) {
        console.error("Failed to log user activity:", error);
    }
}
