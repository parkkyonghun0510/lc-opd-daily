import { S3Client, PutObjectCommand, DeleteObjectCommand, ObjectCannedACL } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const bucketName = process.env.AWS_S3_BUCKET || "";

/**
 * Uploads a file to S3 bucket
 * @param file The file to upload
 * @param folder Optional folder path inside bucket
 * @returns Object with the S3 URL and key
 */
export async function uploadToS3(
  file: Buffer,
  contentType: string,
  folder: string = "avatars"
): Promise<{ url: string; key: string }> {
  if (!bucketName) {
    throw new Error("AWS S3 bucket name is not defined");
  }

  // Generate unique filename with original extension
  const fileExt = contentType.split("/")[1] || "jpg";
  const fileName = `${uuidv4()}.${fileExt}`;
  const key = folder ? `${folder}/${fileName}` : fileName;

  // Upload to S3
  const uploadParams = {
    Bucket: bucketName,
    Key: key,
    Body: file,
    ContentType: contentType,
    CacheControl: "max-age=31536000", // Cache for 1 year
  };

  try {
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    // Construct the URL
    const url = `https://${bucketName}.s3.${
      process.env.AWS_REGION || "us-east-1"
    }.amazonaws.com/${key}`;

    return { url, key };
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw new Error("Failed to upload file to S3");
  }
}

/**
 * Deletes a file from S3 bucket
 * @param key The S3 object key to delete
 */
export async function deleteFromS3(key: string): Promise<void> {
  if (!bucketName) {
    throw new Error("AWS S3 bucket name is not defined");
  }

  const deleteParams = {
    Bucket: bucketName,
    Key: key,
  };

  try {
    const command = new DeleteObjectCommand(deleteParams);
    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw new Error("Failed to delete file from S3");
  }
}

/**
 * Extracts the S3 key from a full S3 URL
 * @param url The full S3 URL
 * @returns The S3 key
 */
export function getKeyFromUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    // Extract the path without the leading slash
    return urlObj.pathname.substring(1);
  } catch (error) {
    console.error("Invalid URL:", error);
    return null;
  }
}

/**
 * Gets a pre-signed URL for a file in S3
 * @param key The S3 object key
 * @param expiresIn Time in seconds until the pre-signed URL expires
 * @returns The pre-signed URL
 */
export async function getSignedS3Url(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!bucketName) {
    throw new Error("AWS S3 bucket name is not defined");
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw new Error("Failed to generate signed URL");
  }
} 