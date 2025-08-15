import { uploadFile, deleteFile, getFilePathFromUrl } from './file-storage';
import { v4 as uuidv4 } from "uuid";
import path from 'path';

/**
 * Uploads a file to local storage
 * @param file The file to upload
 * @param contentType The content type of the file
 * @param folder Optional folder path
 * @returns Object with the local URL and file path
 */
export async function upload(
  file: Buffer,
  contentType: string,
  folder: string = "avatars"
): Promise<{ url: string; key: string }> {
  try {
    const result = await uploadFile(file, `file.${contentType.split('/')[1] || 'jpg'}`, folder, contentType);
    return { url: result.url, key: result.filePath };
  } catch (error) {
    console.error("Error uploading file:", error);
    throw new Error("Failed to upload file");
  }
}

/**
 * Deletes a file from local storage
 * @param key The file path to delete
 */
export async function deleteFromStorage(key: string): Promise<void> {
  try {
    await deleteFile(key);
  } catch (error) {
    console.error("Error deleting file:", error);
    throw new Error("Failed to delete file");
  }
}

/**
 * Extracts the file path from a local storage URL
 * @param url The full local storage URL
 * @returns The local file path
 */
export function extractKeyFromUrl(url: string): string {
  return getFilePathFromUrl(url) || '';
}

/**
 * Returns the public URL for a local file
 * @param key The local file path
 * @param expiresIn Ignored for local storage
 * @returns Public URL
 */
export async function getSignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  // For local storage, we return the public URL directly
  // The key should be a relative path from the uploads directory
  const fileName = path.basename(key);
  const folder = path.dirname(key).replace(process.env.UPLOAD_DIR || './uploads', '').replace(/^\//, '');
  
  const publicUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/uploads/${folder ? folder + '/' : ''}${fileName}`;
  
  return publicUrl;
}