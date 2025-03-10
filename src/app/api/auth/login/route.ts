import { NextResponse } from "next/server";
import { authenticateUser, logUserActivity } from "@/lib/auth";
import { generateToken, setTokenCookie } from "@/lib/jwt";
import {
  isAccountLocked,
  recordFailedLoginAttempt,
  resetFailedLoginAttempts,
  getRemainingLockoutTime,
} from "@/lib/utils/account-security";

// POST /api/auth/login - Authenticate a user
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Check if account is locked
    const accountLocked = await isAccountLocked(username);
    if (accountLocked) {
      const remainingMinutes = await getRemainingLockoutTime(username);
      return NextResponse.json(
        {
          error: "Account temporarily locked",
          lockoutRemaining: remainingMinutes,
          message: `Too many failed login attempts. Please try again in ${remainingMinutes} minutes.`,
        },
        { status: 429 } // Too Many Requests
      );
    }

    const user = await authenticateUser(username, password);

    if (!user) {
      // Record failed login attempt
      const isNowLocked = await recordFailedLoginAttempt(username);

      // If the account is now locked, return a specific message
      if (isNowLocked) {
        const lockoutMinutes = await getRemainingLockoutTime(username);
        return NextResponse.json(
          {
            error: "Account locked",
            message: `Too many failed login attempts. Account locked for ${lockoutMinutes} minutes.`,
          },
          { status: 429 } // Too Many Requests
        );
      }

      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Reset failed login attempts on successful login
    await resetFailedLoginAttempts(user.id);

    // Generate JWT token (now async)
    const token = await generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      branchId: user.branchId || undefined,
    });

    // Set JWT token in cookie
    await setTokenCookie(token);

    // Get request information for activity logging
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Log the login activity with request information
    await logUserActivity(
      user.id,
      "login",
      { method: "api" },
      { ipAddress: ip, userAgent }
    );

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
