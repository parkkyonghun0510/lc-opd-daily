"use server";

import { warmCache } from "@/lib/cache-warmer";

export async function warmCacheAction() {
  try {
    await warmCache();
    return { success: true };
  } catch (error) {
    console.error("Failed to warm cache:", error);
    return { success: false, error: "Failed to warm cache" };
  }
}
