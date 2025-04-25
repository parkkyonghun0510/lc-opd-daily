import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { sanitizeString } from "@/utils/sanitize";
import { CommentItem } from "@/types/reports";
import { v4 as uuidv4 } from "uuid";

/**
 * Parses legacy comments string into a structured format
 * @param comments The legacy comments string
 * @param defaultUserId The default user ID to use if no user is specified
 * @returns An array of parsed comments with user info
 */
async function parseCommentsString(comments: string | null, defaultUserId: string): Promise<Array<{ content: string, userId: string }>> {
  if (!comments) return [];

  try {
    const parsedComments: Array<{ content: string, userId: string }> = [];

    // First, sanitize the comments string to remove any invalid UTF-8 characters
    const sanitizedComments = sanitizeString(comments) || '';

    // Match all types of comment patterns:
    // 1. [RESUBMISSION timestamp]: message
    // 2. [COMMENT timestamp by username]: message
    // 3. [REJECTION timestamp]: message
    const commentParts = sanitizedComments.split(/\[(RESUBMISSION|COMMENT|REJECTION) ([^\]]+)\]:/);

    if (commentParts.length <= 1) {
      // No special markup, just add as a single comment
      if (sanitizedComments.trim()) {
        parsedComments.push({
          content: sanitizedComments.trim(),
          userId: defaultUserId
        });
      }
      return parsedComments;
    }

    // Process the matched parts
    for (let i = 1; i < commentParts.length; i += 3) {
      const type = commentParts[i]?.toLowerCase();
      const metaInfo = commentParts[i + 1];
      const text = commentParts[i + 2]?.trim();

      if (!text) continue;

      // Extract user ID from meta info if available
      let userId = defaultUserId;
      if (metaInfo && metaInfo.includes('by ')) {
        const usernamePart = metaInfo.split('by ')[1];
        if (usernamePart) {
          // Try to find the user by name
          try {
            const user = await prisma.user.findFirst({
              where: {
                OR: [
                  { name: { contains: usernamePart.trim() } },
                  { username: { contains: usernamePart.trim() } }
                ]
              }
            });
            if (user) {
              userId = user.id;
            }
          } catch (error) {
            console.warn(`Could not find user for name: ${usernamePart}`, error);
          }
        }
      }

      // Create a sanitized comment object
      parsedComments.push({
        content: sanitizeString(text) || '',
        userId: userId
      });
    }

    return parsedComments;
  } catch (error) {
    console.error('Error parsing comments:', error);
    return [{
      content: 'Error parsing original comments',
      userId: defaultUserId
    }];
  }
}

/**
 * Parses commentArray JSON into a structured format
 * @param commentArray The commentArray JSON
 * @param defaultUserId The default user ID to use if no user is specified
 * @returns An array of parsed comments with user info
 */
async function parseCommentArray(commentArray: any, defaultUserId: string): Promise<Array<{ content: string, userId: string }>> {
  if (!commentArray || !Array.isArray(commentArray) || commentArray.length === 0) {
    return [];
  }

  try {
    const results = [];

    for (const comment of commentArray) {
      if (!comment) continue;

      // Try to extract user ID from the comment
      let userId = comment.userId || defaultUserId;

      // Verify the user exists
      try {
        const userExists = await prisma.user.findUnique({
          where: { id: userId }
        });
        if (!userExists) {
          userId = defaultUserId;
        }
      } catch (error) {
        userId = defaultUserId;
      }

      results.push({
        content: sanitizeString(comment.text) || '',
        userId: userId
      });
    }

    return results;
  } catch (error) {
    console.error('Error parsing commentArray:', error);
    return [];
  }
}

// POST /api/tools/migrate-report-comments - Migrate comments from Report to ReportComment
export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated and has admin privileges
    const token = await getToken({ req: request });
    if (!token || token.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin privileges required" },
        { status: 401 }
      );
    }

    // Log the user who is running the migration
    console.log(`Comment migration initiated by admin: ${token.sub} (${token.name || 'Unknown'})`);

    // We know that commentArray doesn't exist in the Prisma schema
    // So we'll only query for reports with comments
    console.log("Only querying for reports with comments field (commentArray not available)");

    const reports = await prisma.report.findMany({
      where: {
        comments: { not: null }
      }
    });

    console.log(`Found ${reports.length} reports with comments to migrate`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each report
    for (const report of reports) {
      try {
        // Get existing ReportComment records for this report
        const existingComments = await prisma.reportComment.findMany({
          where: { reportId: report.id }
        });

        // Skip if comments already exist for this report
        if (existingComments.length > 0) {
          console.log(`Skipping report ${report.id} - already has ${existingComments.length} comments`);
          continue;
        }

        // Parse comments from string source only
        // We know commentArray doesn't exist in the Prisma schema
        const commentsFromString = await parseCommentsString(report.comments, report.submittedBy);

        // Use only comments from string source
        const allComments = [...commentsFromString];

        // Skip if no comments to migrate
        if (allComments.length === 0) {
          console.log(`Skipping report ${report.id} - no valid comments to migrate`);
          continue;
        }

        // Create ReportComment records
        for (const comment of allComments) {
          if (!comment.content) continue;

          await prisma.reportComment.create({
            data: {
              reportId: report.id,
              userId: comment.userId,
              content: comment.content
            }
          });
        }

        successCount++;
        if (successCount % 10 === 0) {
          console.log(`Migrated comments for ${successCount} reports so far...`);
        }
      } catch (error) {
        console.error(`Error migrating comments for report ${report.id}:`, error);
        errorCount++;
        errors.push(`Report ${report.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration completed with ${successCount} successes and ${errorCount} errors`,
      totalReports: reports.length,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Error in comment migration:", error);
    return NextResponse.json(
      { error: "Migration failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
