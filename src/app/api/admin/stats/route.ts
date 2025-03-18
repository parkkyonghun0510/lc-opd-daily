import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/lib/auth/roles";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if user has admin access
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user?.role || user.role !== "ADMIN") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Fetch statistics
    const [totalUsers, adminUsers, totalBranches] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          role: "ADMIN",
        },
      }),
      prisma.branch.count(),
    ]);

    return NextResponse.json({
      totalUsers,
      adminUsers,
      totalBranches,
      systemStatus: "Active",
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 