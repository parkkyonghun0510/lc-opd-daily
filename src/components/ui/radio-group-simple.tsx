"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Simple implementation of RadioGroup that doesn't rely on @radix-ui/react-radio-group
// This is used as a fallback for production builds to avoid dependency issues

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
}

const RadioGroupContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
}>({})

function RadioGroup({
  className,
  value,
  onValueChange,
  defaultValue,
  ...props
}: RadioGroupProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "")
  
  const contextValue = React.useMemo(() => ({
    value: value !== undefined ? value : internalValue,
    onValueChange: (newValue: string) => {
      setInternalValue(newValue)
      onValueChange?.(newValue)
    }
  }), [value, internalValue, onValueChange])
  
  return (
    <RadioGroupContext.Provider value={contextValue}>
      <div
        role="radiogroup"
        className={cn("grid gap-3", className)}
        {...props}
      />
    </RadioGroupContext.Provider>
  )
}

interface RadioGroupItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

function RadioGroupItem({
  className,
  value,
  children,
  ...props
}: RadioGroupItemProps) {
  const { value: groupValue, onValueChange } = React.useContext(RadioGroupContext)
  const checked = value === groupValue
  
  return (
    <div className="flex items-center space-x-2">
      <div
        role="radio"
        aria-checked={checked}
        data-state={checked ? "checked" : "unchecked"}
        onClick={() => onValueChange?.(value)}
        className={cn(
          "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          checked && "border-primary",
          className
        )}
        {...props}
      >
        {checked && (
          <div className="relative flex items-center justify-center">
            <div className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

export { RadioGroup, RadioGroupItem }
