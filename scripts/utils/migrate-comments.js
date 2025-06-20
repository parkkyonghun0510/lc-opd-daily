// Script to migrate existing string-based comments to the new array-based format
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

async function migrateComments() {
  console.log("Starting comment migration...");

  // Get all reports with comments
  const reports = await prisma.report.findMany({
    where: {
      comments: {
        not: null,
      },
    },
  });

  // Filter reports that don't have a commentArray or have an empty commentArray
  const reportsToMigrate = reports.filter((report) => {
    return (
      !report.commentArray ||
      (Array.isArray(report.commentArray) &&
        report.commentArray.length === 0) ||
      (typeof report.commentArray === "object" &&
        Object.keys(report.commentArray).length === 0)
    );
  });

  console.log(
    `Found ${reports.length} reports with comments, ${reportsToMigrate.length} need migration`,
  );

  let successCount = 0;
  let errorCount = 0;

  for (const report of reportsToMigrate) {
    try {
      // Parse the comments string
      const commentArray = parseCommentsToArray(
        report.comments,
        report.submittedBy,
      );

      // Update the report with the new commentArray
      await prisma.report.update({
        where: { id: report.id },
        data: {
          commentArray,
        },
      });

      successCount++;
      if (successCount % 10 === 0) {
        console.log(`Migrated ${successCount} reports so far...`);
      }
    } catch (error) {
      console.error(`Error migrating comments for report ${report.id}:`, error);
      errorCount++;
    }
  }

  console.log(
    `Migration complete. Successfully migrated ${successCount} reports.`,
  );
  if (errorCount > 0) {
    console.log(`Failed to migrate ${errorCount} reports.`);
  }
}

function parseCommentsToArray(comments, defaultUserId) {
  if (!comments) return [];

  // If commentArray is already a JSON string, try to parse it
  if (
    typeof comments === "string" &&
    comments.startsWith("[") &&
    comments.endsWith("]")
  ) {
    try {
      const parsed = JSON.parse(comments);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
        console.log("Found already parsed comment array, using it directly");
        return parsed;
      }
    } catch (e) {
      // Not valid JSON, continue with normal parsing
    }
  }

  try {
    const commentArray = [];

    // Match all types of comment patterns:
    // 1. [RESUBMISSION timestamp]: message
    // 2. [COMMENT timestamp by username]: message
    // 3. [REJECTION timestamp]: message
    const commentParts = comments.split(
      /\[(RESUBMISSION|COMMENT|REJECTION) ([^\]]+)\]:/,
    );

    if (commentParts.length <= 1) {
      // No special markup, just add as a single comment
      if (comments.trim()) {
        commentArray.push({
          id: uuidv4(),
          type: "comment",
          text: comments.trim(),
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
        type: "rejection",
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

      commentArray.push({
        id: uuidv4(),
        type: type,
        text: text,
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

// Run the migration
migrateComments()
  .catch((e) => {
    console.error("Error during migration:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
