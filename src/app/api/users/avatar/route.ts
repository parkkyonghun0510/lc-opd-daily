import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { existsSync } from "fs";

const prisma = new PrismaClient();

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "avatars");

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdir(UPLOAD_DIR, { recursive: true }).catch((error) => {
    console.error("Failed to create upload directory:", error);
  });
}

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

    // Generate unique filename with original extension
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = join(UPLOAD_DIR, fileName);

    try {
      // Write file to disk
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);
    } catch (error) {
      console.error("Failed to write file:", error);
      return NextResponse.json(
        { error: "Failed to save the uploaded file" },
        { status: 500 }
      );
    }

    try {
      // Update user's avatar URL in database
      const avatarUrl = `/uploads/avatars/${fileName}`;
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
      // If database update fails, try to clean up the uploaded file
      try {
        await unlink(filePath);
      } catch (unlinkError) {
        console.error("Failed to clean up file after db error:", unlinkError);
      }
      throw error;
    }
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
