import React from "react";
import CurrencyInput from "react-currency-input-field";
// Add Label import (assuming you're using a UI library)
import { Label } from "@/components/ui/label";

interface KHCustomCurrencyInputProps extends CustomCurrencyInputProps {
  label?: string;
  error?: string;
}

export function KHCurrencyInput({
  label,
  error,
  ...props
}: KHCustomCurrencyInputProps) {
  return (
    <div className="grid w-full items-center gap-1.5">
      {label && <Label htmlFor={props.name}>{label}</Label>}
      <CurrencyInput
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        intlConfig={{ locale: "km-KH" }}
        decimalScale={3}
        groupSeparator=","
        decimalSeparator="."
        suffix="៛"
        step={1}
        {...props}
      />
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
