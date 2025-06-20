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
    const decoder = new TextDecoder("utf-8", { fatal: false });

    // Encode and then decode to remove invalid UTF-8 sequences
    const encoded = encoder.encode(str);
    const decoded = decoder.decode(encoded);

    // Remove null bytes (0x00) and other control characters that might cause issues
    // This includes all ASCII control characters (0x00-0x1F) and DEL (0x7F)
    // Also remove any other characters that might cause PostgreSQL UTF-8 encoding issues
    const sanitized = decoded
      // Remove ASCII control characters and DEL
      .replace(/[\x00-\x1F\x7F]/g, "")
      // Remove non-printable and control characters from Unicode
      .replace(/[\u0080-\u009F]/g, "")
      // Remove zero-width characters and other invisible formatting characters
      .replace(/[\u200B-\u200F\u2028-\u202E\u2060-\u2064]/g, "")
      // Remove any remaining invalid UTF-8 sequences (represented as replacement character �)
      .replace(/\uFFFD/g, "");

    // If the sanitized string is different from the original, log it for debugging
    if (sanitized !== decoded) {
      console.log("Sanitized string contains removed characters");
    }

    return sanitized;
  } catch (error) {
    // If any error occurs during encoding/decoding, fall back to basic sanitization
    console.warn(
      "Error during UTF-8 sanitization, falling back to basic sanitization:",
      error,
    );

    // Apply a more aggressive fallback sanitization
    // Only keep basic ASCII printable characters (32-126) and common Unicode ranges
    return str.replace(
      /[^\x20-\x7E\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u0370-\u03FF\u0400-\u04FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/g,
      "",
    );
  }
}

/**
 * Sanitizes form input before submission
 * @param formData The form data object to sanitize
 * @returns A new object with sanitized string values
 */
export function sanitizeFormData<T extends Record<string, any>>(
  formData: T,
): T {
  const sanitized = { ...formData } as T;

  // Deep sanitization function to handle nested objects
  const deepSanitize = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle Date objects - convert to ISO string
    if (obj instanceof Date) {
      return obj.toISOString();
    }

    if (typeof obj === "string") {
      return sanitizeString(obj) || "";
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => deepSanitize(item));
    }

    if (typeof obj === "object") {
      const sanitizedObj: Record<string, any> = {};
      for (const k in obj) {
        sanitizedObj[k] = deepSanitize(obj[k]);
      }
      return sanitizedObj;
    }

    return obj;
  };

  // Apply deep sanitization to each property
  for (const key in sanitized) {
    if (
      key === "date" ||
      (typeof key === "string" && key.toLowerCase().endsWith("date"))
    ) {
      const dateValue = sanitized[key] as unknown;
      let isoString: string;

      if (
        dateValue &&
        typeof dateValue === "object" &&
        dateValue instanceof Date
      ) {
        isoString = dateValue.toISOString();
      } else if (typeof dateValue === "string") {
        const dateObj = new Date(dateValue);
        if (!isNaN(dateObj.getTime())) {
          isoString = dateObj.toISOString();
        } else {
          console.warn(
            "Invalid date string detected, using current date as fallback",
          );
          isoString = new Date().toISOString();
        }
      } else if (
        dateValue &&
        typeof dateValue === "object" &&
        Object.keys(dateValue as object).length === 0
      ) {
        console.warn(
          "Empty object detected for date field, using current date as fallback",
        );
        isoString = new Date().toISOString();
      } else {
        console.warn(
          "Invalid date value detected, using current date as fallback",
        );
        isoString = new Date().toISOString();
      }

      (sanitized as any)[key] = isoString;
    } else {
      (sanitized as any)[key] = deepSanitize(sanitized[key]);
    }
  }

  return sanitized;
}
