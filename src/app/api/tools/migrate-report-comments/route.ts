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
 * @returns An array of parsed comments with user info and parent-child relationships
 */
async function parseCommentsString(
  comments: string | null,
  defaultUserId: string,
): Promise<Array<{ content: string; userId: string; parentId?: string }>> {
  if (!comments) return [];

  try {
    const parsedComments: Array<{
      content: string;
      userId: string;
      parentId?: string;
      id?: string;
    }> = [];

    // First, sanitize the comments string to remove any invalid UTF-8 characters
    const sanitizedComments = sanitizeString(comments) || "";

    // Match all types of comment patterns:
    // 1. [RESUBMISSION timestamp]: message
    // 2. [COMMENT timestamp by username]: message
    // 3. [REJECTION timestamp]: message
    // 4. [REPLY parentId timestamp by username]: message
    const commentParts = sanitizedComments.split(
      /\[(RESUBMISSION|COMMENT|REJECTION|REPLY) ([^\]]+)\]:/,
    );

    if (commentParts.length <= 1) {
      // No special markup, just add as a single comment
      if (sanitizedComments.trim()) {
        parsedComments.push({
          id: uuidv4(),
          content: sanitizedComments.trim(),
          userId: defaultUserId,
        });
      }
      return parsedComments;
    }

    // Create a map to store comment IDs for parent-child relationships
    const commentIdMap = new Map();

    // Process the matched parts
    for (let i = 1; i < commentParts.length; i += 3) {
      const type = commentParts[i]?.toLowerCase();
      const metaInfo = commentParts[i + 1];
      const text = commentParts[i + 2]?.trim();

      if (!text) continue;

      // Generate a unique ID for this comment
      const commentId = uuidv4();

      // Extract user ID from meta info if available
      let userId = defaultUserId;
      let parentId = undefined;

      if (metaInfo) {
        // Handle REPLY type comments (extract parentId)
        if (type === "reply" && metaInfo.includes("to ")) {
          const parts = metaInfo.split("to ");
          if (parts.length > 1) {
            const parentRef = parts[1].split(" ")[0].trim();
            // If the parentRef is a valid comment ID in our map, use it
            if (commentIdMap.has(parentRef)) {
              parentId = commentIdMap.get(parentRef);
            }
          }
        }

        // Extract username if available
        if (metaInfo.includes("by ")) {
          const usernamePart = metaInfo.split("by ")[1];
          if (usernamePart) {
            // Try to find the user by name
            try {
              const user = await prisma.user.findFirst({
                where: {
                  OR: [
                    { name: { contains: usernamePart.trim() } },
                    { username: { contains: usernamePart.trim() } },
                  ],
                },
              });
              if (user) {
                userId = user.id;
              }
            } catch (error) {
              console.warn(
                `Could not find user for name: ${usernamePart}`,
                error,
              );
            }
          }
        }
      }

      // Create a sanitized comment object
      const comment = {
        id: commentId,
        content: sanitizeString(text) || "",
        userId: userId,
        parentId: parentId,
      };

      // Store the comment ID in the map for potential child comments
      commentIdMap.set(i.toString(), commentId);

      parsedComments.push(comment);
    }

    return parsedComments;
  } catch (error) {
    console.error("Error parsing comments:", error);
    return [
      {
        content: "Error parsing original comments",
        userId: defaultUserId,
      },
    ];
  }
}

// Note: The commentArray parsing function has been removed as it's no longer used in the application

// POST /api/tools/migrate-report-comments - Migrate comments from Report to ReportComment
export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated and has admin privileges
    const token = await getToken({ req: request });
    if (!token || token.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin privileges required" },
        { status: 401 },
      );
    }

    // Log the user who is running the migration
    console.log(
      `Comment migration initiated by admin: ${token.sub} (${token.name || "Unknown"})`,
    );

    // Query for reports with comments
    console.log("Querying for reports with comments field");

    const reports = await prisma.report.findMany({
      where: {
        comments: { not: null },
      },
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
          where: { reportId: report.id },
        });

        // Skip if comments already exist for this report
        if (existingComments.length > 0) {
          console.log(
            `Skipping report ${report.id} - already has ${existingComments.length} comments`,
          );
          continue;
        }

        // Parse comments from the comments string
        const parsedComments = await parseCommentsString(
          report.comments,
          report.submittedBy,
        );

        // Skip if no comments to migrate
        if (parsedComments.length === 0) {
          console.log(
            `Skipping report ${report.id} - no valid comments to migrate`,
          );
          continue;
        }

        // Create ReportComment records
        for (const comment of parsedComments) {
          if (!comment.content) continue;

          await prisma.reportComment.create({
            data: {
              reportId: report.id,
              userId: comment.userId,
              content: comment.content,
              parentId: comment.parentId || null,
            },
          });
        }

        successCount++;
        if (successCount % 10 === 0) {
          console.log(
            `Migrated comments for ${successCount} reports so far...`,
          );
        }
      } catch (error) {
        console.error(
          `Error migrating comments for report ${report.id}:`,
          error,
        );
        errorCount++;
        errors.push(
          `Report ${report.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration completed with ${successCount} successes and ${errorCount} errors`,
      totalReports: reports.length,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in comment migration:", error);
    return NextResponse.json(
      {
        error: "Migration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
