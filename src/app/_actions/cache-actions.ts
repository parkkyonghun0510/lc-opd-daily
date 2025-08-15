"use server";

import { invalidateUserBranchCaches } from "@/lib/cache/branch-cache";
import { warmCache } from "@/lib/cache-warmer";

export async function invalidateUserBranchCachesAction(userId: string) {
  try {
    await invalidateUserBranchCaches(userId);
    return { success: true };
  } catch (error) {
    console.error('Error invalidating user branch caches:', error);
    return { success: false, error: 'Failed to invalidate cache' };
  }
}

export async function warmCacheAction() {
  try {
    await warmCache();
    return { success: true };
  } catch (error) {
    console.error("Failed to warm cache:", error);
    return { success: false, error: "Failed to warm cache" };
  }
}
