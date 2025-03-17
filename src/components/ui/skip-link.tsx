"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SkipLinkProps {
  children: React.ReactNode;
  className?: string;
}

export function SkipLink({ children, className }: SkipLinkProps) {
  return (
    <a
      href="#main-content"
      className={cn(
        "sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-white focus:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900",
        className
      )}
    >
      {children}
    </a>
  );
}
