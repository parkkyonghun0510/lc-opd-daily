/**
 * Helper function to safely convert any value to a number
 *
 * This function handles various types of inputs:
 * - Prisma Decimal objects (with toNumber method)
 * - String numbers
 * - Regular numbers
 * - Null/undefined values
 *
 * @param value The value to convert to a number
 * @returns A number representation of the value, or 0 if conversion fails
 */
export function toNumber(value: any): number {
  if (value === null || value === undefined) {
    return 0;
  }

  // Handle Prisma Decimal objects
  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }

  // Handle regular numbers
  if (typeof value === "number") {
    return value;
  }

  // Handle string numbers
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Default fallback
  return 0;
}
