"use client";

import { Filter } from "lucide-react";
import { MobileSelect } from "@/components/ui/mobile-select";
import { cn } from "@/lib/utils";

interface StatusOption {
  value: string;
  label: string;
  description?: string;
  color?: string;
}

interface MobileStatusFilterProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  showAnyOption?: boolean;
  customOptions?: StatusOption[];
}

// Default status options
const defaultStatusOptions: StatusOption[] = [
  { 
    value: "any", 
    label: "Any Status", 
    description: "Show all reports regardless of status"
  },
  { 
    value: "pending", 
    label: "Pending", 
    description: "Reports waiting for review",
    color: "text-yellow-600"
  },
  { 
    value: "pending_approval", 
    label: "Pending Approval", 
    description: "Reports waiting for final approval",
    color: "text-orange-600"
  },
  { 
    value: "approved", 
    label: "Approved", 
    description: "Reports that have been approved",
    color: "text-green-600"
  },
  { 
    value: "rejected", 
    label: "Rejected", 
    description: "Reports that have been rejected",
    color: "text-red-600"
  },
];

export function MobileStatusFilter({
  value,
  onChange,
  placeholder = "Select status",
  className = "",
  disabled = false,
  id,
  showAnyOption = true,
  customOptions,
}: MobileStatusFilterProps) {
  // Use custom options or default ones
  const statusOptions = customOptions || defaultStatusOptions;
  
  // Filter options based on showAnyOption
  const availableOptions = showAnyOption 
    ? statusOptions 
    : statusOptions.filter(option => option.value !== "any");

  // Convert to MobileSelect format
  const selectOptions = availableOptions.map(option => ({
    value: option.value,
    label: option.label,
    disabled: false,
  }));

  const handleValueChange = (selectedValue: string) => {
    // Convert "any" to undefined for API compatibility
    const finalValue = selectedValue === "any" ? undefined : selectedValue;
    onChange?.(finalValue || selectedValue);
  };

  // Get current selection with "any" fallback
  const currentValue = value || (showAnyOption ? "any" : "");

  return (
    <div className={cn("space-y-1", className)}>
      <label 
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Status
      </label>
      
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
        
        <MobileSelect
          value={currentValue}
          onValueChange={handleValueChange}
          options={selectOptions}
          placeholder={placeholder}
          disabled={disabled}
          id={id}
          aria-label="Filter by status"
          className="w-full"
          triggerClassName="pl-9" // Space for the filter icon
          contentClassName="max-h-[50vh] md:max-h-[300px]"
        />
      </div>
      
      {/* Current selection description */}
      {currentValue && (
        <div className="text-xs text-muted-foreground">
          {(() => {
            const selectedOption = statusOptions.find(opt => opt.value === currentValue);
            return selectedOption?.description && (
              <span className={selectedOption.color}>
                {selectedOption.description}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// Simple status badge component for displaying status
export function StatusBadge({ 
  status, 
  className 
}: { 
  status: string;
  className?: string;
}) {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return {
          label: 'Pending',
          className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        };
      case 'pending_approval':
        return {
          label: 'Pending Approval',
          className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
        };
      case 'approved':
        return {
          label: 'Approved',
          className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        };
      case 'rejected':
        return {
          label: 'Rejected',
          className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        };
      default:
        return {
          label: status,
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      "min-h-[28px]", // Ensure reasonable touch target for mobile
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}

// Quick status toggle for common use cases
export function QuickStatusToggle({
  value,
  onChange,
  className
}: {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  const quickOptions = [
    { value: "any", label: "All" },
    { value: "pending_approval", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div className={cn("flex gap-1 flex-wrap", className)}>
      {quickOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange?.(option.value === "any" ? "" : option.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            "min-h-[36px] touch-manipulation", // Mobile touch target
            (value || "any") === option.value
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}