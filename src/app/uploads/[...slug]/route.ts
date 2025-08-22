import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

// Railway-compatible upload directory configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || (process.env.RAILWAY_ENVIRONMENT ? '/app/uploads' : './uploads');
const IS_RAILWAY = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  try {
    const filePath = path.join(UPLOAD_DIR, ...slug);

    // Security check: ensure the path is within the upload directory
    const resolvedPath = path.resolve(filePath);
    const uploadDir = path.resolve(UPLOAD_DIR);

    if (!resolvedPath.startsWith(uploadDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if file exists
    try {
      await fs.access(resolvedPath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Read file content
    const fileBuffer = await fs.readFile(resolvedPath);

    // Determine content type based on file extension
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Railway-optimized headers for static file serving
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': IS_RAILWAY ? 'public, max-age=86400' : 'public, max-age=31536000', // 1 day on Railway, 1 year locally
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    };

    // Add ETag for better caching
    if (IS_RAILWAY) {
      const stats = await fs.stat(resolvedPath);
      headers['ETag'] = `"${stats.mtime.getTime()}-${stats.size}"`;
    }

    return new NextResponse(Buffer.from(fileBuffer), { headers });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}