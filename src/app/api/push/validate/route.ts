import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const data = await request.json();

    if (!data?.endpoint) {
      return NextResponse.json(
        { error: "Invalid subscription data", valid: false },
        { status: 400 },
      );
    }

    // Check if subscription exists in database
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: {
        endpoint: data.endpoint,
      },
    });

    // Return result
    return NextResponse.json({
      valid: !!existingSubscription,
      exists: !!existingSubscription,
    });
  } catch (error) {
    console.error("Error validating push subscription:", error);
    return NextResponse.json(
      {
        error: "Failed to validate push subscription",
        valid: false,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
