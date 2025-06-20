"use server";

import { getServerSession } from "next-auth/next";
import { getPrisma } from "@/lib/prisma-server";
import { revalidatePath } from "next/cache";
import { UserPreferences } from "../types";
import { authOptions } from "@/lib/auth/options";
import { UserRole } from "@/lib/auth/roles";

// Type for user profile update data
type UserProfileUpdate = {
  name?: string;
  email?: string;
  image?: string;
};

// Default preferences
const defaultPreferences: UserPreferences = {
  notifications: {
    reportUpdates: true,
    reportComments: true,
    reportApprovals: true,
  },
  appearance: {
    compactMode: false,
  },
};

// Fetch user data from server
export async function fetchUserData() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return { status: 401, error: "Unauthorized" };
    }

    const prisma = await getPrisma();
    const userData = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        branch: true,
      },
    });

    if (!userData) {
      return { status: 404, error: "User not found" };
    }

    // Get user preferences with default values if not set
    const userPreferences =
      (userData.preferences as unknown as UserPreferences) ||
      defaultPreferences;

    // Format user data with computed fields
    const user = {
      id: userData.id,
      name: userData.name || "",
      email: userData.email,
      role: userData.role,
      image: userData.image || undefined,
      username: userData.username || undefined,
      isActive: userData.isActive,
      branch: userData.branch || undefined,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      preferences: userPreferences,
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
        canAccessAdmin: userData.role === UserRole.ADMIN,
        canViewAnalytics: [
          UserRole.ADMIN,
          UserRole.BRANCH_MANAGER,
          UserRole.SUPERVISOR,
        ].includes(userData.role as UserRole),
        canViewAuditLogs: [UserRole.ADMIN, UserRole.BRANCH_MANAGER].includes(
          userData.role as UserRole,
        ),
        canCustomizeDashboard: [
          UserRole.ADMIN,
          UserRole.BRANCH_MANAGER,
          UserRole.SUPERVISOR,
        ].includes(userData.role as UserRole),
        canManageSettings: [UserRole.ADMIN, UserRole.BRANCH_MANAGER].includes(
          userData.role as UserRole,
        ),
      },
    };

    return { status: 200, data: user };
  } catch (error) {
    console.error("Error fetching user data:", error);
    return { status: 500, error: "Internal server error" };
  }
}

// Update user profile
export async function updateUserProfile(data: UserProfileUpdate) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return { status: 401, error: "Unauthorized" };
    }

    const prisma = await getPrisma();
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    revalidatePath("/profile");
    return { status: 200, data: updatedUser };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return { status: 500, error: "Failed to update profile" };
  }
}

// Update user preferences
export async function updateUserPreferences(
  preferences: Partial<UserPreferences>,
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return { status: 401, error: "Unauthorized" };
    }

    const prisma = await getPrisma();
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences },
      select: {
        id: true,
        preferences: true,
      },
    });

    revalidatePath("/settings");
    return { status: 200, data: updatedUser };
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return { status: 500, error: "Failed to update preferences" };
  }
}
