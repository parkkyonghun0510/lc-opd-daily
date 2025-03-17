import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Combined middleware function
// The withAuth middleware handles protected routes and authentication
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

    // Prisma Client handling - check if this is an API route that should allow database access
    const apiRoutes = [
      "/api/auth",
      "/api/users",
      "/api/reports",
      "/api/branches",
    ];
    const isApiRoute = apiRoutes.some((route) => path.startsWith(route));

    // If this is a client-side route, add header to indicate no Prisma should be used
    if (!isApiRoute) {
      const response = NextResponse.next();
      response.headers.set("X-Prisma-Client", "disabled");
      return response;
    }

    // For all other authenticated requests, allow access
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Special handling for login page when already logged in
        if (path === "/login") {
          // If user is authenticated, they shouldn't access login page
          if (token) {
            return false; // This will trigger a redirect to dashboard
          }
          return true; // Allow unauthenticated users to access login
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

// Comprehensive matcher configuration that combines all needs
export const config = {
  matcher: [
    // Protected routes (requiring auth)
    "/((?!api|_next/static|_next/image|favicon.ico|public|login).*)",

    // Special routes that need middleware processing but not auth
    "/login",

    // API routes that need Prisma client header handling
    "/api/:path*",
  ],
};
