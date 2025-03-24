import { NextRequest, NextResponse } from "next/server";

/**
 * API route that provides placeholder avatars for development
 * This can be used when S3 images aren't accessible in local development
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const seed = searchParams.get('seed') || 'user';
  const bg = searchParams.get('bg') || '4f46e5';
  
  // Redirect to a placeholder avatar service
  return NextResponse.redirect(
    `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=${bg}`
  );
} 