"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function Breadcrumbs() {
  const pathname = usePathname() || '';

  // Skip the first empty string and dashboard
  const pathSegments = pathname
    .split("/")
    .filter((segment) => segment && segment !== "dashboard");

  const breadcrumbs = pathSegments.map((segment, index) => {
    const href = `/dashboard${pathSegments
      .slice(0, index + 1)
      .map((s) => `/${s}`)
      .join("")}`;
    return {
      href,
      label:
        segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " "),
    };
  });

  if (pathname === "/dashboard") {
    return null; // Don't show breadcrumbs on the main dashboard page
  }

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
      <Link
        href="/dashboard"
        className="flex items-center hover:text-gray-900 dark:hover:text-white"
      >
        <Home size={16} />
      </Link>

      {breadcrumbs.map((breadcrumb, index) => (
        <div key={breadcrumb.href} className="flex items-center">
          <ChevronRight size={16} className="mx-1" />
          <Link
            href={breadcrumb.href}
            className={cn(
              "hover:text-gray-900 dark:hover:text-white",
              index === breadcrumbs.length - 1 &&
              "text-gray-900 dark:text-white font-medium"
            )}
          >
            {breadcrumb.label}
          </Link>
        </div>
      ))}
    </nav>
  );
}
