import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// JWT secret should be stored in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = 604800; // 7 days in seconds

// Convert secret to Uint8Array for jose
const secretKey = new TextEncoder().encode(JWT_SECRET);

export type TokenPayload = {
  userId: string;
  username: string;
  role: string;
  branchId?: string;
};

// Generate a JWT token using jose
export async function generateToken(payload: TokenPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN)
    .sign(secretKey);

  return token;
}

// Verify a JWT token using jose
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as TokenPayload;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

// Set JWT token in cookies
export async function setTokenCookie(token: string) {
  (await cookies()).set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: JWT_EXPIRES_IN,
    path: "/",
    sameSite: "strict",
  });
}

// Get JWT token from cookies
export async function getTokenFromCookies(): Promise<string | undefined> {
  return (await cookies()).get("auth_token")?.value;
}

// Clear JWT token from cookies
export async function clearTokenCookie() {
  (await cookies()).delete("auth_token");
}

// Get current user from JWT token
export async function getUserFromToken(): Promise<TokenPayload | null> {
  const token = await getTokenFromCookies();
  if (!token) return null;

  return await verifyToken(token);
}
