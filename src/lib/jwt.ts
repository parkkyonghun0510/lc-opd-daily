import { cookies } from "next/headers";
import { NextRequest } from "next/server";

// Import the getUserFromToken function from auth.ts
import { getUserFromToken as getNextAuthUser } from "./auth";

export type TokenPayload = {
  userId: string;
  username: string;
  role: string;
  branchId?: string;
};

// DEPRECATED: Use NextAuth signIn instead
// This function is kept for backwards compatibility
export async function generateToken(_payload: TokenPayload): Promise<string> {
  console.warn("generateToken is deprecated. Use NextAuth signIn instead.");
  // This is a placeholder that returns a dummy token
  // In a real migration, you would handle the transition strategy here
  return "placeholder-token-migration-in-progress";
}

// DEPRECATED: Use NextAuth getToken instead
// This function is kept for backwards compatibility
export async function verifyToken(
  _token: string
): Promise<TokenPayload | null> {
  console.warn("verifyToken is deprecated. Use NextAuth getToken instead.");
  // This is a placeholder
  return null;
}

// DEPRECATED: Use NextAuth cookies instead
// This function is kept for backwards compatibility
export async function setTokenCookie(_token: string) {
  console.warn(
    "setTokenCookie is deprecated. NextAuth handles cookies automatically."
  );
  // NextAuth handles cookies automatically, so this is just a no-op for compatibility
}

// DEPRECATED: Use NextAuth cookies instead
// This function is kept for backwards compatibility
export async function getTokenFromCookies(): Promise<string | undefined> {
  console.warn(
    "getTokenFromCookies is deprecated. Use NextAuth cookies instead."
  );
  return (await cookies()).get("next-auth.session-token")?.value;
}

// DEPRECATED: Use NextAuth signOut instead
// This function is kept for backwards compatibility
export async function clearTokenCookie() {
  console.warn("clearTokenCookie is deprecated. Use NextAuth signOut instead.");
  // NextAuth handles cookie clearing on signOut, so this is just a no-op for compatibility
}

// DEPRECATED: Use NextAuth getToken or getSession instead
// This function is kept for backwards compatibility
export async function getUserFromToken(
  req?: NextRequest
): Promise<TokenPayload | null> {
  console.warn(
    "getUserFromToken in jwt.ts is deprecated. Use NextAuth getToken or getSession instead."
  );
  return getNextAuthUser(req);
}
