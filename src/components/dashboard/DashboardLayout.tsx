"use client";

import { useState } from "react";
import { RoleBasedNavigation } from "@/components/navigation/RoleBasedNavigation";
import { AuthStatusIndicator } from "@/auth/components/AuthStatusIndicator";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { ProtectedRoute } from "@/auth/components/ProtectedRoute";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * DashboardLayout component
 *
 * A layout for dashboard pages with role-based navigation and authentication status.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
        {/* Mobile sidebar */}
        <div
          className={cn(
            "fixed inset-0 z-40 flex md:hidden",
            sidebarOpen ? "block" : "hidden"
          )}
        >
          {/* Sidebar backdrop */}
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar */}
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white dark:bg-gray-800 pt-5 pb-4">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <X className="h-6 w-6 text-white" />
              </Button>
            </div>

            {/* Logo */}
            <div className="flex flex-shrink-0 items-center px-4">
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Dashboard
              </span>
            </div>

            {/* Navigation */}
            <div className="mt-5 h-0 flex-1 overflow-y-auto">
              <RoleBasedNavigation />
            </div>
          </div>
        </div>

        {/* Static sidebar for desktop */}
        <div className="hidden md:flex md:flex-shrink-0">
          <div className="flex w-64 flex-col">
            <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                {/* Logo */}
                <div className="flex flex-shrink-0 items-center px-4">
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    Dashboard
                  </span>
                </div>

                {/* Navigation */}
                <div className="mt-5 flex-1">
                  <RoleBasedNavigation />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top navigation */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <span className="sr-only">Open sidebar</span>
                <Menu className="h-6 w-6" />
              </Button>

              {/* User dropdown */}
              <div className="ml-auto">
                <AuthStatusIndicator />
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
