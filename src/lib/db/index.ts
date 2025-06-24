import { PrismaClient } from "@prisma/client";

// Prevent multiple instances of Prisma Client in development
declare global {
  let prisma: PrismaClient | undefined;
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

const prisma = globalThis.prisma ?? prismaClientSingleton();

export { prisma };

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

// Add type guard to ensure Prisma only runs on server
export const ensureServerOnly = () => {
  if (typeof window !== "undefined") {
    throw new Error("This function can only be called on the server side");
  }
};
