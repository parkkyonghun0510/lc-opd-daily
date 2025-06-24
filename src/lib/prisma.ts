import { PrismaClient } from "@prisma/client";

// Check if this code is running on the client side (browser)
// and throw an appropriate error if it is
const isClient = typeof window !== "undefined";
if (isClient) {
  throw new Error(
    "PrismaClient cannot be used in the browser. " +
      "Please use server actions or API routes for database operations.",
  );
}

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

// Create an interface that extends PrismaClient with our custom methods
interface ExtendedPrismaClient extends PrismaClient {
  $transact: <T>(tx: () => Promise<T>) => Promise<T>;
}

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient;
};

// Prisma doesn't directly support connection pool config in the client
// This is handled by the underlying connection URL in PostgreSQL
export const prisma =
  globalForPrisma.prisma ||
  (new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  }) as ExtendedPrismaClient);

// Add transaction helper method
prisma.$transact = async <T>(tx: () => Promise<T>): Promise<T> => {
  try {
    return await prisma.$transaction(tx, {
      maxWait: 5000, // Max time to wait for a transaction to start
      timeout: 10000, // Max time for the transaction to complete
    });
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  }
};

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Make sure this file is used on the server only
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
