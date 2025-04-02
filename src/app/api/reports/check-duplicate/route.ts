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
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existingReport = await prisma.report.findFirst({
      where: {
        branchId,
        date: {
          gte: startOfDay.toISOString(),
          lt: endOfDay.toISOString()
        },
        reportType,
      },
    });

    console.log(`Duplicate check result: ${!!existingReport}`);
    
    return NextResponse.json({ isDuplicate: !!existingReport });
  } catch (error) {
    console.error("Error checking for duplicate report:", error);
    return NextResponse.json(
      { error: "Failed to check for duplicate report" },
      { status: 500 }
    );
  }
}
