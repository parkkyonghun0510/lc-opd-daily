import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
import { uploadToS3, deleteFromS3, getKeyFromUrl } from "@/lib/s3";
import fs from "fs";
import path from "path";
import { mkdir } from "fs/promises";

const prisma = new PrismaClient();

// Feature flag for S3 usage
const USE_S3_STORAGE = process.env.USE_S3_STORAGE === "true";
const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const BASE_URL = IS_DEVELOPMENT
  ? "http://localhost:3000"
  : "https://reports.lchelpdesk.com";

// Local file storage setup
const UPLOAD_DIR = path.join(process.cwd(), "public/uploads/avatars");

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
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
        { status: 400 },
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size too large. Maximum size is 5MB." },
        { status: 400 },
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

    let avatarUrl = "";
    if (USE_S3_STORAGE) {
      // Upload to S3
      const { url } = await uploadToS3(buffer, file.type);
      avatarUrl = url;

      // If user has an existing S3 avatar, delete it
      if (user?.image && user.image.includes(".amazonaws.com/")) {
        const existingKey = getKeyFromUrl(user.image);
        if (existingKey) {
          try {
            await deleteFromS3(existingKey);
          } catch (error) {
            console.warn("Failed to delete old avatar:", error);
            // Continue with the update even if deletion fails
          }
        }
      }
    } else {
      // For development/testing without S3, save files locally
      // Create directory if it doesn't exist
      try {
        await mkdir(UPLOAD_DIR, { recursive: true });

        // Generate a unique filename
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${file.type.split("/")[1]}`;
        const filePath = path.join(UPLOAD_DIR, fileName);

        // Write file to disk
        fs.writeFileSync(filePath, buffer);

        // Set the URL for the avatar
        avatarUrl = `${BASE_URL}/uploads/avatars/${fileName}`;

        // Delete old avatar file if it exists
        if (user?.image) {
          try {
            const oldFileName = user.image.split("/").pop();
            if (oldFileName) {
              const oldFilePath = path.join(UPLOAD_DIR, oldFileName);
              if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
              }
            }
          } catch (error) {
            console.warn("Failed to delete old avatar file:", error);
          }
        }
      } catch (error) {
        console.error("Error saving avatar file locally:", error);
        return NextResponse.json(
          { error: "Failed to save avatar file" },
          { status: 500 },
        );
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
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
