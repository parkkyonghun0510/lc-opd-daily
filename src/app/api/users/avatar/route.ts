import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
import { upload, deleteFromStorage, extractKeyFromUrl } from "@/lib/storage";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("avatar") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an image." },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Get user record to check if they have an existing avatar
    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { image: true },
    });

    // Convert file to buffer for upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to local storage
    const { url: avatarUrl } = await upload(buffer, file.type);

    // If user has an existing avatar, delete it
    if (user?.image) {
      const existingKey = extractKeyFromUrl(user.image);
      if (existingKey) {
        try {
          await deleteFromStorage(existingKey);
        } catch (error) {
          console.warn("Failed to delete old avatar:", error);
          // Continue with the update even if deletion fails
        }
      }
    }

    // Update user's avatar URL in database
    const updatedUser = await prisma.user.update({
      where: { id: token.sub },
      data: {
        image: avatarUrl,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        username: true,
      },
    });

    return NextResponse.json({
      message: "Avatar uploaded successfully",
      avatarUrl,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
