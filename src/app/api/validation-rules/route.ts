import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/auth/roles";

// Default validation rules
const defaultRules = {
  writeOffs: {
    maxAmount: 1000,
    requireApproval: true,
  },
  ninetyPlus: {
    maxAmount: 5000,
    requireApproval: true,
  },
  comments: {
    required: true,
    minLength: 10,
  },
  duplicateCheck: {
    enabled: true,
  },
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's role and branch
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        branch: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If user is an admin or doesn't have a branch yet, return default rules
    if (user.role === UserRole.ADMIN || !user.branch) {
      return NextResponse.json(defaultRules);
    }

    try {
      // Try to get organization settings
      const settings = await prisma.organizationSettings.findUnique({
        where: { organizationId: user.branch.id },
      });

      if (settings?.validationRules) {
        return NextResponse.json(settings.validationRules);
      }
    } catch (error) {
      console.warn("Error fetching organization settings:", error);
    }

    // Return default rules if no specific rules found
    return NextResponse.json(defaultRules);
  } catch (error) {
    console.error("Error fetching validation rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch validation rules" },
      { status: 500 }
    );
  }
}
