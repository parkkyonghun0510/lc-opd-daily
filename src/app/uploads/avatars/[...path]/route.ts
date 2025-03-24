import { NextRequest, NextResponse } from "next/server";

// This route handles avatar image requests in development mode
// It returns a placeholder image instead of a 404 error
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  console.log("Development avatar fallback requested:", params.path.join('/'));
  
  // Redirect to a placeholder avatar service
  // Using DiceBear Avatars as a placeholder - you can replace with any placeholder service
  return NextResponse.redirect(
    `https://api.dicebear.com/7.x/initials/svg?seed=${params.path[0]}&backgroundColor=4f46e5`
  );
} 