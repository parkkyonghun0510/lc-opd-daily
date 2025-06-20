"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db/index";
import { revalidatePath } from "next/cache";
import { UserData, UserPreferences } from "../types";
import { UserRole } from "@/lib/auth/roles";

// Fetch user data from server
export async function fetchUserData() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return { status: 401, error: "Unauthorized" };
    }

    const userId = session.user.id;

    const userData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        branch: true,
      },
    });

    if (!userData) {
      return { status: 404, error: "User not found" };
    }

    // Get user preferences with default values if not set
    const userPreferences = (userData.preferences as any) || {
      notifications: {
        reportUpdates: true,
        reportComments: true,
        reportApprovals: true,
      },
      appearance: {
        compactMode: false,
      },
    };

    // Format user data with computed fields
    const user: UserData = {
      id: userData.id,
      name: userData.name || "",
      email: userData.email,
      role: userData.role as UserRole,
      image: userData.image || undefined,
      username: userData.username,
      isActive: userData.isActive,
      branch: userData.branch || undefined,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      computedFields: {
        displayName:
          userData.name || userData.username || userData.email.split("@")[0],
        accessLevel:
          userData.role.charAt(0).toUpperCase() + userData.role.slice(1),
        status: userData.isActive ? "Active" : "Inactive",
        primaryBranch: userData.branch
          ? { name: userData.branch.name, code: userData.branch.code }
          : undefined,
      },
      permissions: {
        canAccessAdmin: userData.role === "ADMIN",
        canViewAnalytics: ["ADMIN", "BRANCH_MANAGER", "SUPERVISOR"].includes(
          userData.role as UserRole,
        ),
        canViewAuditLogs: ["ADMIN", "BRANCH_MANAGER"].includes(
          userData.role as UserRole,
        ),
        canCustomizeDashboard: [
          "ADMIN",
          "BRANCH_MANAGER",
          "SUPERVISOR",
        ].includes(userData.role as UserRole),
        canManageSettings: ["ADMIN", "BRANCH_MANAGER"].includes(
          userData.role as UserRole,
        ),
      },
      preferences: userPreferences,
    };

    return { user };
  } catch (error) {
    console.error("Error fetching user data:", error);
    return { status: 500, error: "Failed to fetch user data" };
  }
}

// Update user profile data
export async function updateUserProfileData(data: Partial<UserData>) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return { status: 401, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Only allow updatable fields
    const updateData = {
      name: data.name,
      email: data.email,
      image: data.image,
    };

    // Filter out undefined values
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined),
    );

    if (Object.keys(filteredData).length === 0) {
      return { status: 400, error: "No valid fields to update" };
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: filteredData,
    });

    revalidatePath("/dashboard");
    return { success: true, user: updatedUser };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return { status: 500, error: "Failed to update user profile" };
  }
}

// Update user preferences
export async function updateUserPreferenceData(
  type: keyof UserPreferences,
  preferences: Partial<UserPreferences[keyof UserPreferences]>,
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return { status: 401, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Get current user with preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    if (!user) {
      return { status: 404, error: "User not found" };
    }

    // Current preferences or default
    const currentPreferences = (user.preferences as any) || {
      notifications: {
        reportUpdates: true,
        reportComments: true,
        reportApprovals: true,
      },
      appearance: {
        compactMode: false,
      },
    };

    // Update the specific preference type
    const updatedPreferences = {
      ...currentPreferences,
      [type]: {
        ...(currentPreferences[type] || {}),
        ...preferences,
      },
    };

    // Save to database
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: updatedPreferences },
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return { status: 500, error: "Failed to update preferences" };
  }
}
