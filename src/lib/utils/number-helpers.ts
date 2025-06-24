/**
 * Helper function to safely convert various types to a number
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

// Define a type for Prisma Decimal objects
interface PrismaDecimal {
  toNumber: () => number;
}

// Type guard to check if a value is a PrismaDecimal
function isPrismaDecimal(value: unknown): value is PrismaDecimal {
  return (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as PrismaDecimal).toNumber === "function"
  );
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  // Handle Prisma Decimal objects
  if (isPrismaDecimal(value)) {
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
