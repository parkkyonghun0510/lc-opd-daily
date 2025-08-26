import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { UserRole } from "@/lib/auth/roles";
import type { NextRequest } from 'next/server';

// Combined middleware function
// The withAuth middleware handles protected routes and authentication
export default withAuth(
  async function middleware(req) {
    const path = req.nextUrl.pathname;

    // Always allow setup-related paths, health checks, and static/PWA assets
    if (
      path === "/setup" ||
      path === "/api/setup" ||
      path === "/api/health" ||
      path.startsWith("/api/health/") ||
      path === "/api/metrics" ||
      path.startsWith("/api/metrics/") ||
      path.startsWith("/_next") ||
      path.startsWith("/static") ||
      path === "/api/test/report-comments" ||
      path === "/test-report-comments" ||
      // PWA/public assets that must be accessible without auth
      path === "/manifest.json" ||
      path === "/service-worker.js" ||
      path === "/sw.js" ||
      path === "/offline.html" ||
      path.startsWith("/icons") ||
      path.startsWith("/favicon") ||
      path.startsWith("/.well-known")
    ) {
      return NextResponse.next();
    }

    // Avatar handling in development
    if (process.env.NODE_ENV === 'development' &&
      path.startsWith('/uploads/avatars/') &&
      !path.includes('.well-known')) {

      // Extract the filename from the URL
      const filename = path.split('/').pop();

      // Create a fallback URL for avatars that may not exist
      return NextResponse.redirect(
        new URL(`https://api.dicebear.com/7.x/initials/svg?seed=${filename}&backgroundColor=4f46e5`, req.url)
      );
    }

    // Get the token
    const token = req.nextauth.token;

    // Handle login path: redirect authenticated users away from login
    if (path === "/login" && token) {
      // Redirect based on role for better UX
      if (token?.role === UserRole.ADMIN) {
        return NextResponse.redirect(new URL("/dashboard/admin", req.url));
      } else if (token?.role === UserRole.BRANCH_MANAGER) {
        return NextResponse.redirect(new URL("/dashboard/branch-manager", req.url));
      }
      return NextResponse.redirect(new URL("/dashboard/user", req.url));
    }

    // Role-based dashboard redirects
    if (path === "/dashboard") {
      // Redirect based on role
      if (token?.role === UserRole.ADMIN) {
        return NextResponse.redirect(new URL("/dashboard/admin", req.url));
      } else if (token?.role === UserRole.BRANCH_MANAGER) {
        return NextResponse.redirect(new URL("/dashboard/branch-manager", req.url));
      } else {
        return NextResponse.redirect(new URL("/dashboard/user", req.url));
      }
    }

    // Role-based API access control (Note: API routes are excluded from matcher below)
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

        // Skip auth for NextAuth internal, health checks, and public/static routes
        if (
          path.startsWith("/api/auth") ||
          path === "/setup" ||
          path === "/api/setup" ||
          path === "/api/health" ||
          path.startsWith("/api/health/") ||
          path === "/api/metrics" ||
          path.startsWith("/api/metrics/") ||
          path.startsWith("/_next") ||
          path.startsWith("/static") ||
          path === "/api/test/report-comments" ||
          path === "/test-report-comments" ||
          // PWA/public assets that must be accessible without auth
          path === "/manifest.json" ||
          path === "/service-worker.js" ||
          path === "/sw.js" ||
          path === "/offline.html" ||
          path.startsWith("/icons") ||
          path.startsWith("/favicon") ||
          path.startsWith("/.well-known")
        ) {
          return true;
        }

        // Always allow home and login pages; top-level middleware will redirect authenticated users
        if (path === "/" || path === "/login") {
          return true;
        }

        // Allow static uploads like avatars without auth
        if (path.startsWith("/uploads/avatars")) {
          return true;
        }

        // For API routes that require authentication, check token
        if (path.startsWith("/api/")) {
          return !!token;
        }

        // For all other paths, require authentication
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    }
  }
);

// Comprehensive matcher configuration
export const config = {
  matcher: [
    // Protected routes (requiring auth)
    // Exclude Next internals, NextAuth routes, health checks, metrics, and public PWA assets from middleware
    // But INCLUDE API routes that need authentication
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|service-worker.js|sw.js|icons|offline.html|robots.txt|sitemap.xml|\\.well-known|public|login|setup|api/health|api/metrics).*)",

    // Explicitly include home, login and setup
    "/",
    "/login",
    "/setup",

    // Add avatar path matcher
    "/uploads/avatars/:path*",

    // Include API routes that need authentication
    "/api/push/:path*",
    "/api/notifications/:path*",
    "/api/users/:path*",
    "/api/reports/:path*",
    "/api/dashboard/:path*",
  ],
};
