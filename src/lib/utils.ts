import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// export function formatKHRCurrency(amount: number): string {
//   return new Intl.NumberFormat("km-KH", {
//     style: "currency",
//     currency: "KHR",
//     currencyDisplay: "narrowSymbol",
//     minimumFractionDigits: 3,
//     maximumFractionDigits: 3,
//   }).format(amount);
// }

export function formatKHRCurrency(amount: number): string {
  // Format the amount using the Khmer locale
  const formatted = new Intl.NumberFormat("km-KH", {
    style: "currency",
    currency: "KHR",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount); // e.g. "៛123,456.790"

  // Define the currency symbol
  const currencySymbol = "៛";

  // Remove the currency symbol and trim any whitespace
  const numericPart = formatted.replace(currencySymbol, "").trim();

  // Append the currency symbol after the numeric part
  return `${numericPart}${currencySymbol}`;
}

/**
 * Format KHR currency for PDF export, replacing the Khmer Riel symbol with "KHR"
 * to avoid encoding issues with non-Latin characters in PDF generation
 */
export function formatKHRCurrencyForPDF(amount: number): string {
  // Format the amount using the en-US locale for consistent number formatting
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  // Append "KHR" instead of the Khmer Riel symbol
  return `${formatted} KHR`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(dateString: string | Date): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
}
