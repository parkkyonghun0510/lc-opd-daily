import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import crypto from "crypto"; // For generating random codes

const LINKING_CODE_EXPIRY_MINUTES = 10;
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;

// POST /api/users/me/telegram/generate-link
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    // 1. Check Authentication
    if (!token?.sub) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }
    const userId = token.sub;

    // 2. Check if bot username is configured
    if (!TELEGRAM_BOT_USERNAME) {
        console.error("TELEGRAM_BOT_USERNAME environment variable is not set.");
        return NextResponse.json(
          { error: "Telegram integration is not configured correctly." },
          { status: 500 }
        );
    }

    // 3. Generate a unique code
    let code: string;
    let isUnique = false;
    let attempts = 0;
    do {
      code = crypto.randomBytes(5).toString('hex'); // Generate a 10-char hex code
      const existingCode = await prisma.telegramLinkingCode.findUnique({
        where: { code },
      });
      isUnique = !existingCode;
      attempts++;
    } while (!isUnique && attempts < 5); // Retry a few times if collision occurs

    if (!isUnique) {
      console.error("Failed to generate a unique Telegram linking code after multiple attempts.");
      return NextResponse.json(
        { error: "Failed to generate linking code, please try again." },
        { status: 500 }
      );
    }

    // 4. Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + LINKING_CODE_EXPIRY_MINUTES);

    // 5. Store the code in the database
    await prisma.telegramLinkingCode.create({
      data: {
        userId: userId,
        code: code,
        expiresAt: expiresAt,
      },
    });

    // 6. Construct the Telegram link
    const telegramLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${code}`;

    // 7. Return the link
    return NextResponse.json({ telegramLink });

  } catch (error) {
    console.error("Error generating Telegram linking code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 