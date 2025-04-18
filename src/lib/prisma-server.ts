// This file is meant to be used ONLY on the server side
// It uses "use server" to prevent bundling with client code

"use server";

import { PrismaClient } from "@prisma/client";

// Global type augmentation
declare global {
  // eslint-disable-next-line no-var
  var cachedPrisma: PrismaClient;
}

let prismaInstance: PrismaClient;

// Check if in production
if (process.env.NODE_ENV === "production") {
  // In production, create a new instance
  prismaInstance = new PrismaClient({
    log: ["error"],
  });
} else {
  // In development, use cached instance to prevent multiple connections
  if (!global.cachedPrisma) {
    global.cachedPrisma = new PrismaClient({
      log: ["query", "error", "warn"],
    });
  }
  prismaInstance = global.cachedPrisma;
}

// Export as async function to comply with "use server" requirements
export async function getPrisma() {
  return prismaInstance;
}

// Export a convenience function for querying
export async function prismaQuery<T>(
  queryFn: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  return queryFn(prismaInstance);
}

// Export types
export type { PrismaClient };
