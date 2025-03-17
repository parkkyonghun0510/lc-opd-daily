import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const branchId = searchParams.get("branchId");
    const reportType = searchParams.get("reportType");

    if (!date || !branchId || !reportType) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Check if a report already exists for this branch on this date
    const existingReport = await prisma.report.findFirst({
      where: {
        branchId,
        date: date,
        reportType,
      },
    });

    return NextResponse.json({ isDuplicate: !!existingReport });
  } catch (error) {
    console.error("Error checking for duplicate report:", error);
    return NextResponse.json(
      { error: "Failed to check for duplicate report" },
      { status: 500 }
    );
  }
}
