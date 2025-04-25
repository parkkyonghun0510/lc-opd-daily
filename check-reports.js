import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Function to sanitize a string
function sanitizeString(str) {
  if (str === null || str === undefined) {
    return null;
  }

  try {
    return str
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(/[\u0080-\u009F]/g, '')
      .replace(/[\u200B-\u200F\u2028-\u202E\u2060-\u2064]/g, '')
      .replace(/\uFFFD/g, '');
  } catch (error) {
    console.warn("Error during UTF-8 sanitization, falling back to basic sanitization:", error);
    return str.replace(/[^\x20-\x7E]/g, '');
  }
}

// Function to parse comments to array
function parseCommentsToArray(comments, defaultUserId) {
  if (!comments) return [];

  try {
    const commentArray = [];
    const sanitizedComments = sanitizeString(comments) || '';

    // Just create a simple comment for testing
    commentArray.push({
      id: uuidv4(),
      type: 'comment',
      text: sanitizedComments.trim(),
      timestamp: new Date().toLocaleString(),
      userId: defaultUserId,
      userName: 'System'
    });

    return commentArray;
  } catch (error) {
    console.error('Error parsing comments:', error);
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

async function checkMigrationStatus() {
  try {
    // Get all reports with comments
    const reportsWithComments = await prisma.report.findMany({
      where: {
        comments: {
          not: null
        }
      }
    });

    // Filter reports with null commentArray
    const reportsToMigrate = reportsWithComments.filter(report => {
      return report.commentArray === null;
    });

    console.log(`Found ${reportsWithComments.length} total reports with comments`);
    console.log(`Found ${reportsToMigrate.length} reports that still need migration`);

    if (reportsToMigrate.length > 0) {
      console.log('Sample report that needs migration:', reportsToMigrate[0]);
    } else {
      console.log('All reports have been successfully migrated!');
    }
  } catch (error) {
    console.error('Error migrating comments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrationStatus();
