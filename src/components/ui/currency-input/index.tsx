"use client";

import React, { useState, useEffect, ChangeEvent, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

// Define the custom props for our KHCurrencyInput component
export interface KHCustomCurrencyInputProps {
  id?: string;
  name?: string;
  value?: string | number;
  onValueChange?: (value: string, formattedValue?: string) => void;
  prefix?: string;
  placeholder?: string;
  className?: string;
  decimalScale?: number;
  label?: string;
  error?: string;
}

// Omit overlapping properties from InputHTMLAttributes
type CurrencyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  keyof KHCustomCurrencyInputProps
> &
  KHCustomCurrencyInputProps;

const formatNumber = (value: string | number): string => {
  // Convert to string if it's a number
  let inputValue = typeof value === "number" ? value.toString() : value || "";

  // Remove all non-digit characters except for decimal point
  inputValue = inputValue.replace(/[^\d.]/g, "");

  // Handle decimal points
  const parts = inputValue.split(".");
  const wholePart = parts[0];
  const decimalPart = parts.length > 1 ? parts[1] : "";

  // Format the whole part with commas
  let formattedWholePart = "";
  if (wholePart.length > 0) {
    // Add commas every 3 digits
    formattedWholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // Build the final formatted value
  if (decimalPart) {
    return `${formattedWholePart}.${decimalPart}`;
  }
  return formattedWholePart;
};

export const KHRielInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value = "",
      onValueChange,
      prefix = "៛",
      placeholder = "0",
      className,
      decimalScale = 0,
      onChange,
      id,
      name,
      label,
      error,
      ...props
    },
    ref
  ) => {
    const [displayValue, setDisplayValue] = useState("");

    useEffect(() => {
      // Format the initial value
      if (value) {
        // Ensure value is either string or number
        const safeValue = typeof value === "object" ? "" : value;
        const formatted = formatNumber(safeValue);
        setDisplayValue(formatted);
      } else {
        setDisplayValue("");
      }
    }, [value]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Remove prefix, commas, and other non-numeric characters for the raw value
      const rawValue = inputValue.replace(
        new RegExp(`[^\\d${decimalScale > 0 ? "." : ""}]`, "g"),
        ""
      );

      // Format the number with commas
      const formattedValue = formatNumber(rawValue);

      // Update the display value
      setDisplayValue(formattedValue);

      // Call the parent's onChange if provided
      if (onChange) {
        onChange(e);
      }

      // Call the onValueChange with both raw and formatted values
      if (onValueChange) {
        onValueChange(rawValue, formattedValue);
      }
    };

    return (
      <div className="grid w-full items-center gap-1.5">
        {label && <Label htmlFor={id || name}>{label}</Label>}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
            {prefix}
          </div>
          <Input
            ref={ref}
            id={id}
            name={name}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            placeholder={placeholder}
            className={cn("pl-8", className)}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm font-medium text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

KHRielInput.displayName = "KHRielInput";

// Create a simpler export alias for better naming
export const KHCurrencyInput = KHRielInput;

// For any other currency support in the future
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (props, ref) => {
    return <KHRielInput ref={ref} {...props} />;
  }
);

CurrencyInput.displayName = "CurrencyInput";

export default KHRielInput;
