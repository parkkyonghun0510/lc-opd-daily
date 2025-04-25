/**
 * Client-side utility functions for sanitizing data before sending to the API
 */

/**
 * Sanitizes a string by removing null bytes and other invalid UTF-8 characters
 * @param str The string to sanitize
 * @returns Sanitized string with null bytes removed
 */
export function sanitizeString(str: string | null | undefined): string | null {
  if (str === null || str === undefined) {
    return null;
  }

  try {
    // First, try to ensure the string is valid UTF-8
    // In browsers, TextEncoder/TextDecoder are available globally
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
 * Sanitizes form input before submission
 * @param formData The form data object to sanitize
 * @returns A new object with sanitized string values
 */
export function sanitizeFormData<T extends Record<string, any>>(formData: T): T {
  const sanitized = { ...formData };

  // Deep sanitization function to handle nested objects
  const deepSanitize = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle Date objects - convert to ISO string
    if (obj instanceof Date) {
      return obj.toISOString();
    }

    if (typeof obj === 'string') {
      return sanitizeString(obj) || '';
    }

    if (Array.isArray(obj)) {
      return obj.map(item => deepSanitize(item));
    }

    if (typeof obj === 'object') {
      // Check if it's an empty object that should be a Date
      if (Object.keys(obj).length === 0 && 'date' in formData) {
        // If we're processing an empty object and the form has a date field,
        // this might be a serialized Date that lost its type
        return new Date().toISOString(); // Use current date as fallback
      }

      const sanitizedObj: Record<string, any> = {};
      for (const key in obj) {
        sanitizedObj[key] = deepSanitize(obj[key]);
      }
      return sanitizedObj;
    }

    // For numbers, booleans, etc., return as is
    return obj;
  };

  // Apply deep sanitization to each property
  for (const key in sanitized) {
    // Special handling for date field
    if (key === 'date') {
      // Ensure date is properly formatted
      const dateValue = sanitized[key];

      if (dateValue instanceof Date) {
        sanitized[key] = dateValue.toISOString();
      } else if (typeof dateValue === 'string') {
        // If it's already a string, make sure it's a valid date string
        const dateObj = new Date(dateValue);
        if (!isNaN(dateObj.getTime())) {
          sanitized[key] = dateObj.toISOString();
        } else {
          // Invalid date string, use current date as fallback
          console.warn('Invalid date string detected, using current date as fallback');
          sanitized[key] = new Date().toISOString();
        }
      } else if (typeof dateValue === 'object' && Object.keys(dateValue).length === 0) {
        // Empty object where date should be, use current date as fallback
        console.warn('Empty object detected for date field, using current date as fallback');
        sanitized[key] = new Date().toISOString();
      } else {
        // For any other case, use current date as fallback
        console.warn('Invalid date value detected, using current date as fallback');
        sanitized[key] = new Date().toISOString();
      }
    } else {
      sanitized[key] = deepSanitize(sanitized[key]);
    }
  }

  return sanitized;
}
