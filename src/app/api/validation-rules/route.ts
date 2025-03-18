import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's branch to determine organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { branch: true },
    });

    if (!user?.branch) {
      return NextResponse.json(
        { error: "User not assigned to a branch" },
        { status: 400 }
      );
    }

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

    try {
      // Try to get organization settings
      const settings = await prisma.organizationSettings.findUnique({
        where: { organizationId: user.branch.id },
      });

      if (settings) {
        return NextResponse.json(settings.validationRules);
      }
    } catch {
      // If the model is not available yet, return default rules
      console.warn(
        "OrganizationSettings model not available, using default rules"
      );
    }

    return NextResponse.json(defaultRules);
  } catch (error) {
    console.error("Error fetching validation rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch validation rules" },
      { status: 500 }
    );
  }
}
