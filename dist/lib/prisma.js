import { PrismaClient } from "@prisma/client";
// Check if this code is running on the client side (browser)
// and throw an appropriate error if it is
const isClient = typeof window !== "undefined";
if (isClient) {
    throw new Error("PrismaClient cannot be used in the browser. " +
        "Please use server actions or API routes for database operations.");
}
// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
    });
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = prisma;
// Make sure this file is used on the server only
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
