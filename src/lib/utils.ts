import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKHRCurrency(amount: number): string {
  return new Intl.NumberFormat("km-KH", {
    style: "currency",
    currency: "KHR",
    currencyDisplay: "symbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace("KHR", "៛"); // Replace KHR with the actual Cambodian Riel symbol
}
