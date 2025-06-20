"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/auth/hooks/useAuth";
import { Loader2 } from "lucide-react";

/**
 * Global loading indicator that shows when authentication is being determined
 * This can be placed in the layout to show a loading state across the entire app
 */
export function GlobalLoadingIndicator() {
  const { isLoading } = useAuth();
  const [visible, setVisible] = useState(false);

  // Only show the loading indicator after a short delay to prevent flashing
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setVisible(true);
      }, 300); // Show after 300ms of loading

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isLoading]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-card shadow-lg border">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div className="space-y-2 text-center">
          <h3 className="font-medium">Loading your account</h3>
          <p className="text-sm text-muted-foreground">
            Please wait while we load your account information...
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Minimal loading indicator that shows in the top-right corner
 * Less intrusive than the full-screen version
 */
export function MinimalLoadingIndicator() {
  const { isLoading } = useAuth();
  const [visible, setVisible] = useState(false);

  // Only show the loading indicator after a short delay to prevent flashing
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setVisible(true);
      }, 300); // Show after 300ms of loading

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isLoading]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-primary text-primary-foreground shadow-md animate-in slide-in-from-top-5 duration-300">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-xs font-medium">Loading...</span>
    </div>
  );
}
