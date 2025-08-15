import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// File storage configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:3000';

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating upload directory:', error);
  }
}

// Initialize storage
ensureUploadDir();

/**
 * Uploads a file to local storage
 * @param fileBuffer The file buffer to upload
 * @param fileName The original filename
 * @param folder Optional folder path
 * @returns Object with the local URL and file path
 */
export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  folder: string = 'avatars',
  contentType?: string
): Promise<{ url: string; filePath: string; fileName: string }> {
  try {
    // Generate unique filename
    const fileExt = path.extname(fileName) || '.jpg';
    const uniqueName = `${uuidv4()}${fileExt}`;
    const folderPath = path.join(UPLOAD_DIR, folder);
    
    // Ensure folder exists
    await fs.mkdir(folderPath, { recursive: true });
    
    // Full file path
    const filePath = path.join(folderPath, uniqueName);
    
    // Write file to disk
    await fs.writeFile(filePath, fileBuffer);
    
    // Construct public URL
    const url = `${PUBLIC_URL}/uploads/${folder}/${uniqueName}`;
    
    return {
      url,
      filePath,
      fileName: uniqueName
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
  }
}

/**
 * Deletes a file from local storage
 * @param filePath The file path to delete
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error deleting file:', error);
    // Don't throw error if file doesn't exist
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error('Failed to delete file');
    }
  }
}

/**
 * Extracts the local file path from a URL
 * @param url The full URL
 * @returns The local file path
 */
export function getFilePathFromUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Extract path after /uploads/
    const match = pathname.match(/^\/uploads\/(.+)$/);
    if (match) {
      return path.join(UPLOAD_DIR, match[1]);
    }
    
    return null;
  } catch (error) {
    console.error('Invalid URL:', error);
    return null;
  }
}

/**
 * Gets file stats
 * @param filePath The file path
 * @returns File stats
 */
export async function getFileStats(filePath: string) {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  } catch (error) {
    console.error('Error getting file stats:', error);
    return null;
  }
}

/**
 * Lists files in a folder
 * @param folder The folder name
 * @returns Array of file information
 */
export async function listFiles(folder: string = 'avatars') {
  try {
    const folderPath = path.join(UPLOAD_DIR, folder);
    const files = await fs.readdir(folderPath);
    
    const fileList = [];
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stats = await getFileStats(filePath);
      if (stats) {
        fileList.push({
          name: file,
          url: `${PUBLIC_URL}/uploads/${folder}/${file}`,
          ...stats
        });
      }
    }
    
    return fileList;
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
}