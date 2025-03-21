"use server";

import { prisma } from "./prisma";
import { User, Branch, Prisma } from "@prisma/client";
import { UserPreferences } from "@/app/types";

type UserWithBranch = Omit<User, "preferences"> & {
  branch: Branch | null;
  preferences: UserPreferences;
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

// Helper function to safely parse preferences
function parsePreferences(jsonData: Prisma.JsonValue | null): UserPreferences {
  if (!jsonData) return defaultPreferences;

  try {
    const parsed = jsonData as Record<string, any>;
    return {
      notifications: {
        reportUpdates: Boolean(parsed?.notifications?.reportUpdates ?? true),
        reportComments: Boolean(parsed?.notifications?.reportComments ?? true),
        reportApprovals: Boolean(
          parsed?.notifications?.reportApprovals ?? true
        ),
      },
      appearance: {
        compactMode: Boolean(parsed?.appearance?.compactMode ?? false),
      },
    };
  } catch {
    return defaultPreferences;
  }
}

// User data operations
export async function getUserData(
  userId: string
): Promise<UserWithBranch | null> {
  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        branch: true,
      },
    });

    if (!user) return null;

    return {
      ...user,
      preferences: parsePreferences(user.preferences),
    } as UserWithBranch;
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw new Error("Failed to fetch user data");
  }
}

export async function updateUserProfile(
  userId: string,
  data: Prisma.UserUpdateInput
) {
  if (!userId) return null;

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      include: {
        branch: true,
      },
    });
    return user;
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw new Error("Failed to update user profile");
  }
}

export async function updateUserPreferences(
  userId: string,
  type: string,
  preferences: any
) {
  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const currentPreferences = parsePreferences(user.preferences);
    const updatedPreferences = {
      ...currentPreferences,
      [type]: preferences,
    };

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        preferences: updatedPreferences,
      },
    });

    return {
      ...updated,
      preferences: parsePreferences(updated.preferences),
    };
  } catch (error) {
    console.error("Error updating user preferences:", error);
    throw new Error("Failed to update user preferences");
  }
}

// Add more data operations as needed
