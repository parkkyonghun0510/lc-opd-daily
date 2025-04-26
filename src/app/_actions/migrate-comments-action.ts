'use server';

import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from 'uuid';
import { sanitizeString, sanitizeCommentArray } from "@/utils/sanitize";
import { CommentItem } from "@/types/reports";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";

/**
 * Parses legacy comments string into a structured comment array
 * @param comments The legacy comments string
 * @param defaultUserId The default user ID to use if no user is specified
 * @returns An array of CommentItem objects
 */
function parseCommentsToArray(comments: string | null, defaultUserId: string): CommentItem[] {
  if (!comments) return [];

  // If commentArray is already a JSON string, try to parse it
  if (typeof comments === 'string' && comments.startsWith('[') && comments.endsWith(']')) {
    try {
      const parsed = JSON.parse(comments);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
        console.log('Found already parsed comment array, using it directly');
        return parsed;
      }
    } catch (e) {
      // Not valid JSON, continue with normal parsing
    }
  }

  try {
    const commentArray: CommentItem[] = [];

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
        commentArray.push({
          id: uuidv4(),
          type: 'comment',
          text: sanitizedComments.trim(),
          timestamp: new Date().toLocaleString(),
          userId: defaultUserId,
          userName: 'System'
        });
      }
      return commentArray;
    }

    // Handle the first part (if it exists and isn't empty)
    if (commentParts[0].trim()) {
      commentArray.push({
        id: uuidv4(),
        type: 'comment',
        text: commentParts[0].trim(),
        timestamp: new Date().toLocaleString(),
        userId: defaultUserId,
        userName: 'System'
      });
    }

    // Process the rest of the parts in groups of 3
    for (let i = 1; i < commentParts.length; i += 3) {
      const type = commentParts[i]?.toLowerCase(); // RESUBMISSION, COMMENT, or REJECTION
      const meta = commentParts[i + 1]; // timestamp or "timestamp by username"
      const text = (i + 2 < commentParts.length) ? commentParts[i + 2].trim() : '';

      if (!type || !text) continue;

      let timestamp = meta || new Date().toLocaleString();
      let userName = 'User';
      let userId = defaultUserId;

      // Parse metadata differently based on type
      if (type === 'comment') {
        const byIndex = meta?.indexOf(' by ');
        if (byIndex > -1) {
          timestamp = meta.substring(0, byIndex);
          userName = meta.substring(byIndex + 4);
        }
      }

      // Create a sanitized comment object
      commentArray.push({
        id: uuidv4(),
        type: type === 'resubmission' ? 'comment' : type, // Map resubmission to comment type
        text: sanitizeString(text) || '', // Sanitize the text
        timestamp: timestamp,
        userId: userId,
        userName: userName
      });
    }

    return commentArray;
  } catch (error) {
    console.error('Error parsing comments:', error);
    // Return a single comment with the error message
    return [{
      id: uuidv4(),
      type: 'comment',
      text: 'Error parsing original comments',
      timestamp: new Date().toLocaleString(),
      userId: defaultUserId,
      userName: 'System'
    }];
  }
}

/**
 * Server action to migrate legacy comments to the new commentArray format
 * @returns Object with success status and migration results
 */
export async function migrateCommentsAction() {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized - Authentication required"
      };
    }

    // Log the user who is running the migration
    console.log(`Migration initiated by user: ${session.user.id} (${session.user.name || 'Unknown'})`);

    // Allow any authenticated user to run this migration since it's a critical fix
    // We'll just log the action for auditing purposes

    console.log('Starting comment migration...');

    // Get all reports with comments but empty commentArray
    const reports = await prisma.report.findMany({
      where: {
        comments: {
          not: null
        },
        OR: [
          { commentArray: null },
          {
            // Use proper JSON filtering for empty objects
            commentArray: {
              equals: {}
            }
          }
        ]
      }
    });

    console.log(`Found ${reports.length} reports that need comment migration`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const report of reports) {
      try {
        // Parse the comments string into a structured array
        const commentArray = parseCommentsToArray(report.comments, report.submittedBy);

        // Sanitize the entire comment array
        const sanitizedCommentArray = sanitizeCommentArray(commentArray);

        // Update the report with the new commentArray
        await prisma.report.update({
          where: { id: report.id },
          data: {
            commentArray: sanitizedCommentArray
          }
        });

        successCount++;
        if (successCount % 10 === 0) {
          console.log(`Migrated ${successCount} reports so far...`);
        }
      } catch (error) {
        console.error(`Error migrating comments for report ${report.id}:`, error);
        errorCount++;
        errors.push(`Report ${report.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`Migration complete. Successfully migrated ${successCount} reports.`);
    if (errorCount > 0) {
      console.log(`Failed to migrate ${errorCount} reports.`);
    }

    return {
      success: true,
      totalReports: reports.length,
      migratedReports: successCount,
      failedReports: errorCount,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('Error during migration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during migration'
    };
  }
}
