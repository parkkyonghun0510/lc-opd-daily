// Script to fix comments with UTF-8 encoding issues
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

/**
 * Sanitizes a string by removing null bytes and other invalid UTF-8 characters
 * @param str The string to sanitize
 * @returns Sanitized string with null bytes removed
 */
function sanitizeString(str) {
  if (str === null || str === undefined) {
    return null;
  }

  try {
    // Remove null bytes (0x00) and other control characters that might cause issues
    // This includes all ASCII control characters (0x00-0x1F) and DEL (0x7F)
    // Also remove any other characters that might cause PostgreSQL UTF-8 encoding issues
    return (
      str
        // Remove ASCII control characters and DEL
        .replace(/[\x00-\x1F\x7F]/g, "")
        // Remove non-printable and control characters from Unicode
        .replace(/[\u0080-\u009F]/g, "")
        // Remove zero-width characters and other invisible formatting characters
        .replace(/[\u200B-\u200F\u2028-\u202E\u2060-\u2064]/g, "")
        // Remove any remaining invalid UTF-8 sequences (represented as replacement character �)
        .replace(/\uFFFD/g, "")
    );
  } catch (error) {
    console.warn(
      "Error during UTF-8 sanitization, falling back to basic sanitization:",
      error,
    );

    // Apply a more aggressive fallback sanitization
    // Only keep basic ASCII printable characters (32-126)
    return str.replace(/[^\x20-\x7E]/g, "");
  }
}

/**
 * Sanitizes a comment array by removing null bytes from all text fields
 * @param commentArray The comment array to sanitize
 * @returns Sanitized comment array
 */
function sanitizeCommentArray(commentArray) {
  if (!commentArray) {
    return null;
  }

  return commentArray.map((comment) => {
    if (!comment) return comment;

    // Create a new comment object with sanitized text
    const sanitizedComment = { ...comment };

    // Sanitize the text field
    if (typeof sanitizedComment.text === "string") {
      sanitizedComment.text = sanitizeString(sanitizedComment.text);
    }

    // Recursively sanitize replies if they exist
    if (Array.isArray(sanitizedComment.replies)) {
      sanitizedComment.replies = sanitizeCommentArray(sanitizedComment.replies);
    }

    return sanitizedComment;
  });
}

/**
 * Parses legacy comments string into a structured comment array
 * @param comments The legacy comments string
 * @param defaultUserId The default user ID to use if no user is specified
 * @returns An array of CommentItem objects
 */
function parseCommentsToArray(comments, defaultUserId) {
  if (!comments) return [];

  try {
    const commentArray = [];

    // First, sanitize the comments string to remove any invalid UTF-8 characters
    const sanitizedComments = sanitizeString(comments) || "";

    // Match all types of comment patterns:
    // 1. [RESUBMISSION timestamp]: message
    // 2. [COMMENT timestamp by username]: message
    // 3. [REJECTION timestamp]: message
    const commentParts = sanitizedComments.split(
      /\[(RESUBMISSION|COMMENT|REJECTION) ([^\]]+)\]:/,
    );

    if (commentParts.length <= 1) {
      // No special markup, just add as a single comment
      if (sanitizedComments.trim()) {
        commentArray.push({
          id: uuidv4(),
          type: "comment",
          text: sanitizedComments.trim(),
          timestamp: new Date().toLocaleString(),
          userId: defaultUserId,
          userName: "System",
        });
      }
      return commentArray;
    }

    // Handle the first part (if it exists and isn't empty)
    if (commentParts[0].trim()) {
      commentArray.push({
        id: uuidv4(),
        type: "comment",
        text: commentParts[0].trim(),
        timestamp: new Date().toLocaleString(),
        userId: defaultUserId,
        userName: "System",
      });
    }

    // Process the rest of the parts in groups of 3
    for (let i = 1; i < commentParts.length; i += 3) {
      const type = commentParts[i]?.toLowerCase(); // RESUBMISSION, COMMENT, or REJECTION
      const meta = commentParts[i + 1]; // timestamp or "timestamp by username"
      const text =
        i + 2 < commentParts.length ? commentParts[i + 2].trim() : "";

      if (!type || !text) continue;

      let timestamp = meta || new Date().toLocaleString();
      let userName = "User";
      let userId = defaultUserId;

      // Parse metadata differently based on type
      if (type === "comment") {
        const byIndex = meta?.indexOf(" by ");
        if (byIndex > -1) {
          timestamp = meta.substring(0, byIndex);
          userName = meta.substring(byIndex + 4);
        }
      }

      // Create a sanitized comment object
      commentArray.push({
        id: uuidv4(),
        type: type === "resubmission" ? "comment" : type, // Map resubmission to comment type
        text: sanitizeString(text) || "", // Sanitize the text
        timestamp: timestamp,
        userId: userId,
        userName: userName,
      });
    }

    return commentArray;
  } catch (error) {
    console.error("Error parsing comments:", error);
    // Return a single comment with the error message
    return [
      {
        id: uuidv4(),
        type: "comment",
        text: "Error parsing original comments",
        timestamp: new Date().toLocaleString(),
        userId: defaultUserId,
        userName: "System",
      },
    ];
  }
}

async function fixComments() {
  console.log("Starting comment fix...");

  // Get all reports with comments but empty commentArray
  const reports = await prisma.report.findMany({
    where: {
      comments: {
        not: null,
      },
      OR: [
        { commentArray: null },
        {
          // Use proper JSON filtering for empty objects
          commentArray: {
            equals: {},
          },
        },
      ],
    },
  });

  console.log(`Found ${reports.length} reports that need comment fixing`);

  let successCount = 0;
  let errorCount = 0;

  for (const report of reports) {
    try {
      // Parse the comments string into a structured array
      const commentArray = parseCommentsToArray(
        report.comments,
        report.submittedBy,
      );

      // Sanitize the entire comment array
      const sanitizedCommentArray = sanitizeCommentArray(commentArray);

      // Update the report with the new commentArray
      await prisma.report.update({
        where: { id: report.id },
        data: {
          commentArray: sanitizedCommentArray,
        },
      });

      successCount++;
      if (successCount % 10 === 0) {
        console.log(`Fixed ${successCount} reports so far...`);
      }
    } catch (error) {
      console.error(`Error fixing comments for report ${report.id}:`, error);
      errorCount++;
    }
  }

  console.log(`Fix complete. Successfully fixed ${successCount} reports.`);
  if (errorCount > 0) {
    console.log(`Failed to fix ${errorCount} reports.`);
  }
}

// Run the fix
fixComments()
  .catch((e) => {
    console.error("Error during comment fix:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
