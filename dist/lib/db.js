"use server";
import { prisma } from "./prisma";
// Default preferences
const defaultPreferences = {
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
function parsePreferences(jsonData) {
    if (!jsonData)
        return defaultPreferences;
    try {
        const parsed = jsonData;
        return {
            notifications: {
                reportUpdates: Boolean(parsed?.notifications?.reportUpdates ?? true),
                reportComments: Boolean(parsed?.notifications?.reportComments ?? true),
                reportApprovals: Boolean(parsed?.notifications?.reportApprovals ?? true),
            },
            appearance: {
                compactMode: Boolean(parsed?.appearance?.compactMode ?? false),
            },
        };
    }
    catch {
        return defaultPreferences;
    }
}
// User data operations
export async function getUserData(userId) {
    if (!userId)
        return null;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                branch: true,
            },
        });
        if (!user)
            return null;
        return {
            ...user,
            preferences: parsePreferences(user.preferences),
        };
    }
    catch (error) {
        console.error("Error fetching user data:", error);
        throw new Error("Failed to fetch user data");
    }
}
export async function updateUserProfile(userId, data) {
    if (!userId)
        return null;
    try {
        const user = await prisma.user.update({
            where: { id: userId },
            data,
            include: {
                branch: true,
            },
        });
        return user;
    }
    catch (error) {
        console.error("Error updating user profile:", error);
        throw new Error("Failed to update user profile");
    }
}
export async function updateUserPreferences(userId, type, preferences) {
    if (!userId)
        return null;
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
    }
    catch (error) {
        console.error("Error updating user preferences:", error);
        throw new Error("Failed to update user preferences");
    }
}
