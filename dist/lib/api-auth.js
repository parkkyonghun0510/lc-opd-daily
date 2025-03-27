import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
export async function withAuth(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
handler, options = {}) {
    return async function (req) {
        try {
            const token = await getToken({ req });
            if (!token) {
                return new NextResponse(JSON.stringify({ error: "Unauthorized: Authentication required" }), { status: 401 });
            }
            // Role-based access control
            if (options.requiredRole) {
                const roles = Array.isArray(options.requiredRole)
                    ? options.requiredRole
                    : [options.requiredRole];
                if (!roles.includes(token.role)) {
                    return new NextResponse(JSON.stringify({
                        error: `Unauthorized: Required role(s): ${roles.join(", ")}`,
                    }), { status: 403 });
                }
            }
            // Branch-specific access control
            if (options.requiredBranchAccess) {
                const urlParts = req.nextUrl.pathname.split("/");
                const branchIdIndex = urlParts.indexOf("branch") + 1;
                const branchId = urlParts[branchIdIndex];
                if (branchId && token.branchId !== branchId && token.role !== "admin") {
                    return new NextResponse(JSON.stringify({ error: "Unauthorized: Invalid branch access" }), { status: 403 });
                }
            }
            // Call the handler with the authenticated request and token
            return handler(req, token);
        }
        catch (error) {
            console.error("API Authentication Error:", error);
            return new NextResponse(JSON.stringify({ error: "Internal server error" }), { status: 500 });
        }
    };
}
// Example usage:
/*
export async function GET(req: NextRequest) {
  return withAuth(
    async (req, token) => {
      // Your protected API logic here
      return NextResponse.json({ data: "Protected data" });
    },
    { requiredRole: ["admin", "manager"] }
  )(req);
}
*/
