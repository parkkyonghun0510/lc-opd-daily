"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface KeyboardShortcutProps {
  keys: string[];
  className?: string;
  description?: string;
}

export function KeyboardShortcut({
  keys,
  className,
  description,
}: KeyboardShortcutProps) {
  return (
    <kbd
      className={cn(
        "px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg",
        className,
      )}
      aria-label={description}
    >
      {keys.map((key, index) => (
        <React.Fragment key={key}>
          {index > 0 && <span className="mx-1">+</span>}
          <span>{key}</span>
        </React.Fragment>
      ))}
    </kbd>
  );
}
