import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { UserRole } from "@/lib/auth/roles";

const prisma = new PrismaClient();

// Check if system needs setup
async function checkIfSystemNeedsSetup() {
  try {
    // Try to count users - if table doesn't exist, this will throw
    await prisma.user.count();
    return false;
  } catch (error) {
    return true;
  }
}

// Combined middleware function
// The withAuth middleware handles protected routes and authentication
export default withAuth(
  async function middleware(req) {
    const path = req.nextUrl.pathname;

    // Always allow setup-related paths and static assets
    if (
      path === "/setup" ||
      path === "/api/setup" ||
      path.startsWith("/_next") ||
      path.startsWith("/static")
    ) {
      return NextResponse.next();
    }

    // Get the token
    const token = req.nextauth.token;

    // Handle root path redirection
    if (path === "/") {
      if (token) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.redirect(new URL("/setup", req.url));
    }

    // If the user is at /dashboard and they're authenticated with role=user,
    // redirect them to /dashboard/reports
    if (path === "/dashboard" && token && token.role === UserRole.USER) {
      return NextResponse.redirect(new URL("/dashboard/reports", req.url));
    }

    // Role-based API access control
    if (path.startsWith("/api/admin") && token?.role !== UserRole.ADMIN) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 403 }
      );
    }

    if (
      path.startsWith("/api/manager") &&
      ![UserRole.ADMIN, UserRole.BRANCH_MANAGER].includes(token?.role as UserRole)
    ) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized: Manager access required" }),
        { status: 403 }
      );
    }

    // Branch-specific access control
    if (path.startsWith("/api/branch/") && token?.branchId) {
      const branchId = path.split("/")[3];
      if (token.branchId !== branchId && token.role !== UserRole.ADMIN) {
        return new NextResponse(
          JSON.stringify({ error: "Unauthorized: Invalid branch access" }),
          { status: 403 }
        );
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Always allow setup-related paths and static assets
        if (
          path === "/setup" ||
          path === "/api/setup" ||
          path.startsWith("/_next") ||
          path.startsWith("/static")
        ) {
          return true;
        }

        // Special handling for login page
        if (path === "/login") {
          if (token) {
            return false; // Redirect to dashboard if already logged in
          }
          return true;
        }

        // For all other paths, require authentication
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

// Comprehensive matcher configuration
export const config = {
  matcher: [
    // Protected routes (requiring auth)
    "/((?!api|_next/static|_next/image|favicon.ico|public|login|setup).*)",

    // Special routes that need middleware processing but not auth
    "/login",
    "/setup",

    // API routes that need processing
    "/api/:path*",
  ],
};
