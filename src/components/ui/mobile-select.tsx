"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MobileSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  children?: React.ReactNode;
}

export function MobileSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  children,
  ...props
}: MobileSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Find selected option
  const selectedOption = options.find(option => option.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: Event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setIsOpen(true);
          setFocusedIndex(0);
        }
        return;
      }

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          setFocusedIndex(-1);
          triggerRef.current?.focus();
          break;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex(prev => {
            const nextIndex = prev < options.length - 1 ? prev + 1 : 0;
            return options[nextIndex]?.disabled ? 
              nextIndex < options.length - 1 ? nextIndex + 1 : 0 : nextIndex;
          });
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex(prev => {
            const nextIndex = prev > 0 ? prev - 1 : options.length - 1;
            return options[nextIndex]?.disabled ? 
              nextIndex > 0 ? nextIndex - 1 : options.length - 1 : nextIndex;
          });
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (focusedIndex >= 0 && !options[focusedIndex]?.disabled) {
            handleSelect(options[focusedIndex].value);
          }
          break;
        case 'Tab':
          setIsOpen(false);
          setFocusedIndex(-1);
          break;
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, focusedIndex, options]);

  // Auto-scroll focused item into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && contentRef.current) {
      const focusedElement = contentRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

  const handleSelect = (optionValue: string) => {
    onValueChange?.(optionValue);
    setIsOpen(false);
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  };

  const handleTriggerClick = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setFocusedIndex(0);
      }
    }
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTriggerClick();
    }
  };

  return (
    <div ref={dropdownRef} className={cn("relative", className)} {...props}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          // Base styles
          "flex items-center justify-between w-full",
          "border border-input bg-background",
          "rounded-md shadow-sm",
          "text-sm text-left",
          "transition-colors",
          
          // Mobile-first sizing (44px minimum touch target)
          "min-h-[44px] h-11 md:h-9",
          "px-3 py-2",
          
          // Touch optimization
          "touch-manipulation",
          
          // Focus and hover states
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "hover:bg-accent hover:text-accent-foreground",
          
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          
          // Active/open state
          isOpen && "ring-2 ring-ring ring-offset-2",
          
          triggerClassName
        )}
      >
        <span className={cn(
          "flex-1 truncate",
          !selectedOption && "text-muted-foreground"
        )}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        
        <ChevronDownIcon 
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div 
          ref={contentRef}
          role="listbox"
          aria-label={ariaLabel || "Options"}
          className={cn(
            // Positioning
            "absolute z-50 w-full mt-1",
            
            // Mobile-first height constraints
            "max-h-[50vh] md:max-h-96",
            "overflow-y-auto",
            
            // Styling
            "bg-popover border border-border rounded-md shadow-lg",
            "py-1",
            
            // Touch optimization
            "touch-manipulation",
            
            contentClassName
          )}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={cn(
                // Base styles
                "flex items-center w-full",
                "cursor-default select-none",
                "text-sm",
                
                // Mobile-first sizing (44px minimum touch target)
                "min-h-[44px] md:min-h-[36px]",
                "px-3 py-2",
                
                // Touch optimization
                "touch-manipulation",
                
                // States
                option.disabled && "opacity-50 cursor-not-allowed",
                !option.disabled && "hover:bg-accent hover:text-accent-foreground",
                index === focusedIndex && "bg-accent text-accent-foreground",
                option.value === value && "bg-primary/10 text-primary"
              )}
              onClick={() => {
                if (!option.disabled) {
                  handleSelect(option.value);
                }
              }}
              onMouseEnter={() => !option.disabled && setFocusedIndex(index)}
            >
              <span className="flex-1 truncate">
                {option.label}
              </span>
              
              {option.value === value && (
                <CheckIcon className="h-4 w-4 text-primary" />
              )}
            </div>
          ))}
          
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground text-center">
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Convenience components for backward compatibility
export function MobileSelectTrigger({ 
  children, 
  className, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

export function MobileSelectValue({ 
  placeholder,
  children 
}: { 
  placeholder?: string;
  children?: React.ReactNode;
}) {
  return <>{children || placeholder}</>;
}

export function MobileSelectContent({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

export function MobileSelectItem({ 
  value,
  children,
  className,
  disabled,
  ...props 
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}