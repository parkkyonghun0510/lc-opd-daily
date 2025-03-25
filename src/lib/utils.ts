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
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount); // e.g. "៛123,456.790"

  // Define the currency symbol
  const currencySymbol = "៛";

  // Remove the currency symbol and trim any whitespace
  const numericPart = formatted.replace(currencySymbol, "").trim();

  // Append the currency symbol after the numeric part
  return `${numericPart}${currencySymbol}`;
}
