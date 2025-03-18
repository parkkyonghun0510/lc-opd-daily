import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createUser, logUserActivity } from "@/lib/auth";
import { validatePassword } from "@/lib/utils/password-validation";

// POST /api/auth/register - Register a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, name, email, password, role, branchId } = body;

    // Validate required fields
    if (!username || !name || !email || !password) {
      return NextResponse.json(
        { error: "Username, name, email, and password are required" },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: "Password is too weak", details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // Create the user
    try {
      const user = await createUser({
        username,
        email,
        name,
        password,
        role: role || "user",
        branchId,
      });

      // NOTE: We're not using JWT tokens directly anymore
      // User needs to explicitly login via NextAuth after registration
      // or the client can handle automatic login after successful registration

      // Get request information for activity logging
      const ip =
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown";
      const userAgent = request.headers.get("user-agent") || "unknown";

      // Log the registration activity
      await logUserActivity(
        user.id,
        "register",
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
    } catch (error: unknown) {
      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes("Email already in use")) {
          return NextResponse.json(
            { error: "Email is already registered" },
            { status: 409 }
          );
        } else if (error.message.includes("Username already in use")) {
          return NextResponse.json(
            { error: "Username is already taken" },
            { status: 409 }
          );
        }
      }
      throw error; // Re-throw other errors to be caught by the outer catch block
    }
  } catch (error) {
    console.error("Error during registration:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
