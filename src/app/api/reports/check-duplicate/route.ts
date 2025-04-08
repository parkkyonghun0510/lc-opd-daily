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
    const dateStr = searchParams.get("date");
    const branchId = searchParams.get("branchId");
    const reportType = searchParams.get("reportType");

    if (!dateStr || !branchId || !reportType) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Parse the date string to a Date object
    const date = new Date(dateStr);

    // Validate that the date is valid
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    console.log(`Checking for duplicate: date=${date.toLocaleDateString()}, branchId=${branchId}, reportType=${reportType}`);

    // Check if a report already exists for this branch on this date
    // Since the date field in the database is a Date type (without time),
    // we should use equals instead of a range query
    const existingReport = await prisma.report.findFirst({
      where: {
        branchId,
        date: date, // Prisma will handle the conversion correctly
        reportType,
      },
      select: {
        id: true,
        status: true,
      }
    });

    console.log(`Duplicate check result: ${!!existingReport}, status: ${existingReport?.status || 'N/A'}`);

    return NextResponse.json({
      isDuplicate: !!existingReport,
      reportId: existingReport?.id || null,
      reportStatus: existingReport?.status || null
    });
  } catch (error) {
    console.error("Error checking for duplicate report:", error);
    return NextResponse.json(
      { error: "Failed to check for duplicate report" },
      { status: 500 }
    );
  }
}
