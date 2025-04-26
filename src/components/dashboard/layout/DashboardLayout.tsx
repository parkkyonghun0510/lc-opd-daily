"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useCompactMode } from "@/contexts/UserDataContext";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isCompactMode = useCompactMode();

  return (
    <div className="flex min-h-screen h-full bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main
          className={cn(
            "flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900",
            isCompactMode ? "p-3" : "p-6"
          )}
        >
          <div
            className={cn(
              "mx-auto pb-8", /* Added padding at the bottom to ensure content doesn't get cut off */
              isCompactMode ? "max-w-5xl space-y-3" : "max-w-7xl space-y-6"
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
