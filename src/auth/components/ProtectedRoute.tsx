"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/auth/store";
import { hasPermission } from "@/auth/store/actions";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  permissions?: string[];
  roles?: string[];
  requireAll?: boolean;
  redirectTo?: string;
  loadingComponent?: React.ReactNode;
}

/**
 * ProtectedRoute component
 *
 * Wraps a page or component to ensure the user is authenticated and has the required permissions.
 * Uses the advanced Zustand store for state management.
 *
 * @example
 * <ProtectedRoute permissions={["VIEW_REPORTS"]}>
 *   <ReportsPage />
 * </ProtectedRoute>
 */
export function ProtectedRoute({
  children,
  permissions = [],
  roles = [],
  requireAll = false,
  redirectTo = "/login",
  loadingComponent = (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, isSessionExpired } = useStore();
  const router = useRouter();

  useEffect(() => {
    // Check if session is expired
    if (isAuthenticated && isSessionExpired()) {
      router.push(redirectTo);
      return;
    }

    // If not loading and not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
      return;
    }

    // If authenticated, check permissions and roles
    if (!isLoading && isAuthenticated && user) {
      let hasAccess = true;

      // Check permissions if specified
      if (permissions.length > 0) {
        if (requireAll) {
          // Must have all permissions
          hasAccess = permissions.every((permission) =>
            hasPermission(permission),
          );
        } else {
          // Must have at least one permission
          hasAccess = permissions.some((permission) =>
            hasPermission(permission),
          );
        }
      }

      // Check roles if specified
      if (roles.length > 0 && hasAccess) {
        hasAccess = roles.includes(user.role);
      }

      // Redirect if doesn't have access
      if (!hasAccess) {
        router.push(redirectTo);
      }
    }
  }, [
    isLoading,
    isAuthenticated,
    user,
    permissions,
    roles,
    requireAll,
    redirectTo,
    router,
    isSessionExpired,
  ]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <>{loadingComponent}</>;
  }

  // If not authenticated, don't render anything (will redirect)
  if (!isAuthenticated || !user) {
    return null;
  }

  // Check permissions and roles
  let hasAccess = true;

  // Check permissions if specified
  if (permissions.length > 0) {
    if (requireAll) {
      // Must have all permissions
      hasAccess = permissions.every((permission) => hasPermission(permission));
    } else {
      // Must have at least one permission
      hasAccess = permissions.some((permission) => hasPermission(permission));
    }
  }

  // Check roles if specified
  if (roles.length > 0 && hasAccess) {
    hasAccess = roles.includes(user.role);
  }

  // If doesn't have access, don't render anything (will redirect)
  if (!hasAccess) {
    return null;
  }

  // If authenticated and has access, render children
  return <>{children}</>;
}
