import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { category, action, label, value } = req.body;

    // Instead of using a non-existent pwaAnalytics model,
    // we'll store the analytics in the UserActivity model
    await prisma.userActivity.create({
      data: {
        userId: "anonymous", // We don't have access to the session in this API route
        action: `pwa_${action}`,
        details: {
          category,
          label,
          value,
        },
        ipAddress: req.headers["x-forwarded-for"]?.toString() || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("PWA Analytics Error:", error);
    res.status(500).json({ message: "Error tracking PWA analytics" });
  }
}
