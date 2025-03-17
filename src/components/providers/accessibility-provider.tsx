"use client";

import * as React from "react";
import { SkipLink } from "@/components/ui/skip-link";

interface AccessibilityProviderProps {
  children: React.ReactNode;
  skipLinkText?: string;
}

export function AccessibilityProvider({
  children,
  skipLinkText,
}: AccessibilityProviderProps) {
  // Track focusable elements
  const focusableElementsRef = React.useRef<HTMLElement[]>([]);

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Tab key navigation
      if (e.key === "Tab") {
        const focusableElements = document.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusableElementsRef.current = Array.from(focusableElements);

        // Store the current focus position
        const currentIndex = focusableElementsRef.current.indexOf(
          document.activeElement as HTMLElement
        );

        // Handle Shift+Tab
        if (e.shiftKey) {
          if (currentIndex <= 0) {
            e.preventDefault();
            focusableElementsRef.current[
              focusableElementsRef.current.length - 1
            ].focus();
          }
        }
        // Handle Tab
        else {
          if (currentIndex >= focusableElementsRef.current.length - 1) {
            e.preventDefault();
            focusableElementsRef.current[0].focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle focus management
  React.useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.matches(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ) {
        target.setAttribute("data-focused", "true");
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      target.removeAttribute("data-focused");
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  return (
    <>
      <SkipLink>{skipLinkText}</SkipLink>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
