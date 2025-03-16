import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

// The withAuth middleware now directly handles protected routes
export default withAuth(
  function middleware(req) {
    console.log("Auth Middleware executing for path:", req.nextUrl.pathname);

    // Get the token and path
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    console.log("Auth state:", token ? "Authenticated" : "Not authenticated");
    if (token) {
      console.log("User role:", token.role);
    }

    // Handle root path redirection
    if (path === "/" && token) {
      console.log("Authenticated user at root, redirecting to dashboard");
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // If the user is at /dashboard and they're authenticated with role=user,
    // redirect them to /dashboard/reports without going through login
    if (path === "/dashboard" && token && token.role === "user") {
      console.log(
        "User role 'user' at dashboard, redirecting directly to reports"
      );
      return NextResponse.redirect(new URL("/dashboard/reports", req.url));
    }

    // Role-based API access control
    if (path.startsWith("/api/admin") && token?.role !== "admin") {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 403 }
      );
    }

    if (
      path.startsWith("/api/manager") &&
      !["admin", "manager"].includes(token?.role as string)
    ) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized: Manager access required" }),
        { status: 403 }
      );
    }

    // Branch-specific access control
    if (path.startsWith("/api/branch/") && token?.branchId) {
      const branchId = path.split("/")[3]; // Get branchId from URL
      if (token.branchId !== branchId && token.role !== "admin") {
        return new NextResponse(
          JSON.stringify({ error: "Unauthorized: Invalid branch access" }),
          { status: 403 }
        );
      }
    }

    // For all other authenticated requests, allow access
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        const isAuthorized = !!token;
        console.log("Authorization check:", isAuthorized ? "Passed" : "Failed");
        return isAuthorized;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

// Create middleware for handling non-protected routes
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Special handling for login page when already logged in
  if (path === "/login") {
    // Check if there's a session token (check both possible token names)
    const sessionToken =
      req.cookies.get("next-auth.session-token")?.value ||
      req.cookies.get(".next-auth.session-token")?.value;

    if (sessionToken) {
      console.log(
        "Session token found on login page, redirecting to dashboard"
      );
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // For all non-login paths, proceed normally
  return NextResponse.next();
}

// Configure which routes each middleware applies to
export const config = {
  matcher: [
    // Apply the default export (withAuth) to protected routes
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|public|login).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    // Apply the named export (middleware) to the login route
    "/login",
  ],
};
