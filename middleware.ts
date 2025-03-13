import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Protected paths that require authentication
const protectedPaths = [
  "/dashboard",
  "/reports",
  "/reports/create",
  "/consolidated",
  "/settings",
  "/profile",
];

// Define paths that are accessible only to specific roles
const roleBasedPaths = {
  admin: ["/admin", "/settings", "/dashboard"],
  manager: ["/consolidated", "/dashboard"],
};

// Rate limiting configuration
const RATE_LIMIT = 100; // requests per window
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const rateLimitStore = new Map();

// Verify JWT token
async function verifyToken(token: string | Uint8Array<ArrayBufferLike>) {
  try {
    // Use TextEncoder to convert the secret to Uint8Array
    const secretKey = new TextEncoder().encode(
      process.env.JWT_SECRET || "your-secret-key"
    );

    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

// Rate limiting function
function rateLimit(ip: string) {
  const now = Date.now();
  const userLimit = rateLimitStore.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

// The middleware function
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log("Middleware executing for path:", pathname);

  // Check if the path is protected
  const isProtectedPath = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // If it's not a protected path, allow the request
  if (!isProtectedPath) {
    return NextResponse.next();
  }

  // Only apply rate limiting to API routes
  if (pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for") || "anonymous";

    if (!rateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  }

  // For protected paths, get the token from cookies
  const token = request.cookies.get("auth_token")?.value;

  // If there's no token, redirect to login
  if (!token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Verify the token
  const payload = await verifyToken(token);

  // If token verification fails, redirect to login
  if (!payload) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  // Check if the user has the required role for this path
  const userRole = payload.role;

  // Check if the path requires a specific role
  const isRoleRestricted = Object.keys(roleBasedPaths).some((role) =>
    [role].some((path) => pathname === path || pathname.startsWith(`${path}/`))
  );

  if (isRoleRestricted) {
    // Check if user has permission for this path
    const hasPermission = roleBasedPaths[
      userRole as keyof typeof roleBasedPaths
    ]?.some(
      (path: string) => pathname === path || pathname.startsWith(`${path}/`)
    );

    if (!hasPermission) {
      // Redirect to home if user doesn't have the required role
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // User is authenticated and has the required role, allow access
  return NextResponse.next();
}

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
