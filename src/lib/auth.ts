import { PrismaClient } from "@prisma/client";
import { compare, hash } from "bcrypt";
import {
  isAccountLocked,
  recordFailedLoginAttempt,
  resetFailedLoginAttempts,
  getRemainingLockoutTime,
} from "./utils/account-security";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export interface CustomUser {
  id: string;
  email: string;
  name: string;
  role: string;
  branchId: string | null;
  username: string;
  password: string;
  lastLogin?: Date;
}

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    branchId: string | null;
    username: string;
    password: string;
    lastLogin?: Date;
  }
  interface Session {
    user: SessionUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    branchId: string | null;
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  branchId: string | null;
}

const prisma = new PrismaClient();

// Type for user without password
export type SafeUser = Omit<CustomUser, "password">;

// Function to hash passwords
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, 10);
}

// Function to verify passwords
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return await compare(password, hashedPassword);
}

// Function to create a new user
export async function createUser(userData: {
  username: string;
  email: string;
  name: string;
  password: string;
  role?: string;
  branchId?: string;
}): Promise<SafeUser> {
  const { username, email, name, password, role = "user", branchId } = userData;

  // Check if user already exists by email first
  const existingUserByEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUserByEmail) {
    throw new Error("Email already in use");
  }

  // Check by username - we'll have to query all users and filter
  const allUsers = await prisma.user.findMany();
  const existingUserByUsername = allUsers.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (existingUserByUsername) {
    throw new Error("Username already in use");
  }

  // Hash the password
  const hashedPassword = await hashPassword(password);

  // Create the user
  const user = await prisma.user.create({
    data: {
      username,
      email,
      name,
      password: hashedPassword,
      role,
      branchId,
    },
  });

  // Return user without password
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword as SafeUser;
}

// Function to authenticate a user
export async function authenticateUser(
  username: string,
  password: string
): Promise<SafeUser | null> {
  // Check if account is locked
  const isLocked = await isAccountLocked(username);
  if (isLocked) {
    const remainingTime = await getRemainingLockoutTime(username);
    throw new Error(
      `Account is locked. Try again in ${remainingTime} minutes.`
    );
  }

  // Find the user by username (case-insensitive)
  // We need to get all users and filter manually since username field might not be indexed
  const allUsers = await prisma.user.findMany();
  const user = allUsers.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    // Record failed attempt but don't reveal if account exists
    await recordFailedLoginAttempt(username);
    return null;
  }

  // Verify password
  const passwordValid = await verifyPassword(password, user.password);

  if (!passwordValid) {
    // Record failed login attempt
    const isNowLocked = await recordFailedLoginAttempt(username);
    if (isNowLocked) {
      const remainingTime = await getRemainingLockoutTime(username);
      throw new Error(
        `Account is now locked due to too many failed attempts. Try again in ${remainingTime} minutes.`
      );
    }
    return null;
  }

  // Reset failed login attempts
  await resetFailedLoginAttempts(user.id);

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  // Return user without password
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword as SafeUser;
}

// Function to get current user from session
export async function getCurrentUser(
  userId: string
): Promise<(SafeUser & { branch?: unknown }) | null> {
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      branch: true,
    },
  });

  if (!user) {
    return null;
  }

  // Return user without password
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword as SafeUser & { branch: unknown };
}

// Function to log activity
export async function logUserActivity(
  userId: string,
  action: string,
  details?: Record<string, unknown>,
  requestInfo?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  try {
    // Log to console for debugging
    console.log(`User ${userId} performed action: ${action}`, details);

    // Safely stringify details object
    let detailsString = null;
    if (details) {
      try {
        detailsString = JSON.stringify(details);
      } catch (e) {
        console.error("Failed to stringify details:", e);
        detailsString = JSON.stringify({
          error: "Failed to stringify details",
          message: String(e),
        });
      }
    }

    // Create an activity log entry in the database
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        details: detailsString,
        ipAddress: requestInfo?.ipAddress || null,
        userAgent: requestInfo?.userAgent || null,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    // Log error but don't throw to prevent disrupting the main flow
    console.error("Failed to log user activity:", error);
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        // Check if account is locked
        const isLocked = await isAccountLocked(credentials.username);
        if (isLocked) {
          const remainingTime = await getRemainingLockoutTime(
            credentials.username
          );
          throw new Error(
            `Account is locked. Try again in ${remainingTime} minutes.`
          );
        }

        const user = await prisma.user.findFirst({
          where: {
            username: credentials.username,
          },
        });

        if (!user) {
          await recordFailedLoginAttempt(credentials.username);
          throw new Error("Invalid credentials");
        }

        const isValid = await compare(credentials.password, user.password);

        if (!isValid) {
          const isNowLocked = await recordFailedLoginAttempt(
            credentials.username
          );
          if (isNowLocked) {
            const remainingTime = await getRemainingLockoutTime(
              credentials.username
            );
            throw new Error(
              `Account is now locked due to too many failed attempts. Try again in ${remainingTime} minutes.`
            );
          }
          throw new Error("Invalid credentials");
        }

        // Reset failed login attempts
        await resetFailedLoginAttempts(user.id);

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
          username: user.username,
          password: user.password,
          lastLogin: user.lastLogin || undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.branchId = user.branchId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as SessionUser).id = token.id as string;
        (session.user as SessionUser).role = token.role as string;
        (session.user as SessionUser).branchId = token.branchId as
          | string
          | null;
      }
      return session;
    },
  },
};
