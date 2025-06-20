import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import {
  isAccountLocked,
  getRemainingLockoutTime,
} from "@/lib/utils/account-security";

// POST /api/auth/login - Pre-authentication checks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 },
      );
    }

    // Check if account is locked before attempting authentication
    // This provides early feedback before NextAuth attempts login
    const accountLocked = await isAccountLocked(username);
    if (accountLocked) {
      const remainingMinutes = await getRemainingLockoutTime(username);
      return NextResponse.json(
        {
          error: "Account temporarily locked",
          lockoutRemaining: remainingMinutes,
          message: `Too many failed login attempts. Please try again in ${remainingMinutes} minutes.`,
        },
        { status: 429 }, // Too Many Requests
      );
    }

    // If account is not locked, return success and let NextAuth handle the actual authentication
    return NextResponse.json({
      success: true,
      message: "Account available for login",
    });
  } catch (error) {
    console.error("Error during login pre-check:", error);
    return NextResponse.json(
      { error: "Authentication pre-check failed" },
      { status: 500 },
    );
  }
}
