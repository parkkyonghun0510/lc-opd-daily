import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Fetch all roles
    const roles = await prisma.role.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
      })),
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
