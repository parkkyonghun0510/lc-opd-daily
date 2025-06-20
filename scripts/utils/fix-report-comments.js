// Script to fix UTF-8 encoding issues in ReportComment model
import { PrismaClient } from "@prisma/client";

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
 * Fixes the ReportComment model by ensuring the parentId field is properly set
 * and sanitizing content to prevent UTF-8 encoding issues
 */
async function fixReportComments() {
  console.log("Starting ReportComment fix...");

  try {
    // 1. First check if the parentId column exists in the ReportComment table
    const checkParentIdQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ReportComment' 
      AND column_name = 'parentId'
    `;

    const result = await prisma.$queryRawUnsafe(checkParentIdQuery);

    if (!result || result.length === 0) {
      console.log(
        "The parentId column does not exist in the ReportComment table. Adding it...",
      );

      // Add the parentId column if it doesn't exist
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ReportComment" ADD COLUMN "parentId" TEXT;
        CREATE INDEX "ReportComment_parentId_idx" ON "ReportComment"("parentId");
        ALTER TABLE "ReportComment" ADD CONSTRAINT "ReportComment_parentId_fkey" 
        FOREIGN KEY ("parentId") REFERENCES "ReportComment"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
      `);

      console.log("Added parentId column to ReportComment table");
    } else {
      console.log(
        "The parentId column already exists in the ReportComment table",
      );
    }

    // 2. Get all report comments
    const comments = await prisma.reportComment.findMany();
    console.log(`Found ${comments.length} report comments to process`);

    let sanitizedCount = 0;

    // 3. Process each comment to sanitize content
    for (const comment of comments) {
      const originalContent = comment.content;
      const sanitizedContent = sanitizeString(originalContent);

      // Only update if content changed after sanitization
      if (sanitizedContent !== originalContent) {
        await prisma.reportComment.update({
          where: { id: comment.id },
          data: { content: sanitizedContent },
        });
        sanitizedCount++;
      }
    }

    console.log(`Sanitized content for ${sanitizedCount} comments`);
    console.log("ReportComment fix completed successfully");
  } catch (error) {
    console.error("Error fixing ReportComment model:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixReportComments().catch((e) => {
  console.error("Error during ReportComment fix:", e);
  process.exit(1);
});
