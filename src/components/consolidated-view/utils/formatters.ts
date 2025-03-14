/**
 * Utility functions for formatting data values
 */

/**
 * Format a number as KHR currency
 * @param value Number to format
 * @param abbreviated Whether to abbreviate large numbers (K, M, B)
 * @returns Formatted currency string
 */
export const formatKHRCurrency = (
  value: number | null | undefined,
  abbreviated = true
): string => {
  if (value === null || value === undefined) return "N/A";

  // For zero values
  if (value === 0) return "0 ៛";

  try {
    // For abbreviated large numbers
    if (abbreviated) {
      if (value >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(1)}B ៛`;
      }
      if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M ៛`;
      }
      if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K ៛`;
      }
    }

    // For regular formatting
    return new Intl.NumberFormat("km-KH", {
      style: "currency",
      currency: "KHR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch (error) {
    console.error("Error formatting currency:", error);
    return `${value} ៛`;
  }
};

/**
 * Format a percentage value
 * @param value Number to format as percentage
 * @param plusSign Whether to show plus sign for positive values
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number | string | null | undefined,
  plusSign = false
): string => {
  if (value === null || value === undefined) return "N/A";

  const numValue = typeof value === "string" ? parseFloat(value) : value;

  // Handle NaN case
  if (isNaN(numValue)) return "N/A";

  // Format with plus sign if requested and value is positive
  if (plusSign && numValue > 0) {
    return `+${numValue.toFixed(1)}%`;
  }

  return `${numValue.toFixed(1)}%`;
};

/**
 * Format a count value with comma separators
 * @param value Number to format
 * @returns Formatted count string
 */
export const formatCount = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";

  return new Intl.NumberFormat().format(value);
};

/**
 * Get a CSS class based on the trend direction
 * @param trend Trend direction ("increasing", "decreasing", or "stable")
 * @param inverseColors Whether to inverse color mapping (used when decreasing is good)
 * @returns CSS class name for styling
 */
export const getTrendColorClass = (
  trend: string | null | undefined,
  inverseColors = false
): string => {
  if (!trend) return "text-gray-500";

  if (inverseColors) {
    // When decreasing is good (e.g., for negative metrics)
    switch (trend) {
      case "increasing":
        return "text-red-500";
      case "decreasing":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  } else {
    // Normal case (increasing is good)
    switch (trend) {
      case "increasing":
        return "text-green-500";
      case "decreasing":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  }
};

/**
 * Get CSS classes for percentage value (positive/negative)
 * @param value Percentage value
 * @param inverseColors Whether to inverse color mapping
 * @returns CSS class name for styling
 */
export const getPercentageColorClass = (
  value: number | string | null | undefined,
  inverseColors = false
): string => {
  if (value === null || value === undefined) return "text-gray-500";

  const numValue = typeof value === "string" ? parseFloat(value) : value;

  // Handle NaN case
  if (isNaN(numValue)) return "text-gray-500";

  if (numValue === 0) return "text-gray-500";

  if (inverseColors) {
    return numValue > 0 ? "text-red-500" : "text-green-500";
  } else {
    return numValue > 0 ? "text-green-500" : "text-red-500";
  }
};
