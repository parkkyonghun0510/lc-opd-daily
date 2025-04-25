/**
 * Utility functions for sanitizing data before saving to the database
 */

import { CommentItem } from "@/types/reports";

/**
 * Sanitizes a string by removing null bytes and other invalid UTF-8 characters
 * that could cause PostgreSQL errors
 * @param str The string to sanitize
 * @returns Sanitized string with null bytes removed
 */
export function sanitizeString(str: string | null | undefined): string | null {
  if (str === null || str === undefined) {
    return null;
  }

  try {
    // First, try to ensure the string is valid UTF-8
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', { fatal: false });

    // Encode and then decode to remove invalid UTF-8 sequences
    const encoded = encoder.encode(str);
    const decoded = decoder.decode(encoded);

    // Remove null bytes (0x00) and other control characters that might cause issues
    // This includes all ASCII control characters (0x00-0x1F) and DEL (0x7F)
    // Also remove any other characters that might cause PostgreSQL UTF-8 encoding issues
    const sanitized = decoded
      // Remove ASCII control characters and DEL
      .replace(/[\x00-\x1F\x7F]/g, '')
      // Remove non-printable and control characters from Unicode
      .replace(/[\u0080-\u009F]/g, '')
      // Remove zero-width characters and other invisible formatting characters
      .replace(/[\u200B-\u200F\u2028-\u202E\u2060-\u2064]/g, '')
      // Remove any remaining invalid UTF-8 sequences (represented as replacement character �)
      .replace(/\uFFFD/g, '');

    // If the sanitized string is different from the original, log it for debugging
    if (sanitized !== decoded) {
      console.log("Sanitized string contains removed characters");
    }

    return sanitized;
  } catch (error) {
    // If any error occurs during encoding/decoding, fall back to basic sanitization
    console.warn("Error during UTF-8 sanitization, falling back to basic sanitization:", error);

    // Apply a more aggressive fallback sanitization
    // Only keep basic ASCII printable characters (32-126) and common Unicode ranges
    return str.replace(/[^\x20-\x7E\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u0370-\u03FF\u0400-\u04FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/g, '');
  }
}

/**
 * Sanitizes a comment array by removing null bytes from all text fields
 * @param commentArray The comment array to sanitize
 * @returns Sanitized comment array
 */
export function sanitizeCommentArray(commentArray: CommentItem[] | null | undefined): CommentItem[] | null {
  if (!commentArray) {
    return null;
  }

  return commentArray.map(comment => {
    if (!comment) return comment;

    // Create a new comment object with sanitized text
    const sanitizedComment = { ...comment };

    // Sanitize the text field
    if (typeof sanitizedComment.text === 'string') {
      sanitizedComment.text = sanitizeString(sanitizedComment.text);
    }

    // Recursively sanitize replies if they exist
    if (Array.isArray(sanitizedComment.replies)) {
      sanitizedComment.replies = sanitizeCommentArray(sanitizedComment.replies);
    }

    return sanitizedComment;
  });
}
