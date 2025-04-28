"use client";

import { ReactNode, useEffect, useState } from "react";
import { useStore } from "@/auth/store";
import { hasPermission, hasBranchAccess } from "@/auth/store/actions";
import { Loader2, ShieldAlert } from "lucide-react";
import { trackAuthEvent, AuthEventType } from '@/auth/utils/analytics';
import { Skeleton } from "@/components/ui/skeleton";

interface PermissionGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  permissions?: string[];
  roles?: string[];
  requireAll?: boolean;
  branchId?: string;
  showLoading?: boolean;
  loadingComponent?: ReactNode;
}

/**
 * PermissionGate component
 *
 * Controls access to UI components based on user permissions and roles.
 * Uses the advanced Zustand store for state management.
 *
 * @example
 * <PermissionGate
 *   permissions={["VIEW_REPORTS"]}
 *   fallback={<AccessDenied />}
 * >
 *   <ReportsTable />
 * </PermissionGate>
 */
export function PermissionGate({
  children,
  fallback = null,
  permissions = [],
  roles = [],
  requireAll = false,
  branchId,
  showLoading = true,
  loadingComponent = (
    <div className="w-full space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-[120px] w-full rounded-md" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
    </div>
  ),
}: PermissionGateProps) {
  // Get auth state from store
  const { isLoading, isAuthenticated, user } = useStore();

  // Track access state
  const [hasAccess, setHasAccess] = useState(false);

  // Check permissions and update access state
  useEffect(() => {
    // Default to no access if not authenticated
    if (!isAuthenticated || !user) {
      setHasAccess(false);
      return;
    }

    // Start with access granted
    let accessGranted = true;

    // Check permissions if specified
    if (permissions.length > 0) {
      if (requireAll) {
        // Must have all permissions
        accessGranted = permissions.every(permission => hasPermission(permission));
      } else {
        // Must have at least one permission
        accessGranted = permissions.some(permission => hasPermission(permission));
      }
    }

    // Check roles if specified and still has access
    if (roles.length > 0 && accessGranted) {
      accessGranted = roles.includes(user.role);
    }

    // Check branch access if specified and still has access
    if (branchId && accessGranted) {
      accessGranted = hasBranchAccess(branchId);
    }

    // Update access state
    setHasAccess(accessGranted);

    // Track permission denied events
    if (!accessGranted) {
      trackAuthEvent(AuthEventType.PERMISSION_DENIED, {
        userId: user.id,
        username: user.email,
        role: user.role,
        details: {
          permissions,
          roles,
          requireAll,
          branchId
        }
      });
    }
  }, [isAuthenticated, user, permissions, roles, requireAll, branchId]);

  // Create a default fallback if none provided
  const defaultFallback = (
    <div className="flex flex-col items-center justify-center p-6 text-red-500 space-y-2 border border-red-200 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-800">
      <ShieldAlert className="h-8 w-8" />
      <div className="text-center">
        <h3 className="font-medium">Permission Denied</h3>
        <p className="text-sm text-red-400 dark:text-red-300">
          You don't have the required permissions to access this content
        </p>
      </div>
    </div>
  );

  // Render based on loading and access state
  if (isLoading && showLoading) {
    return <>{loadingComponent}</>;
  }

  // Add a fade-in animation for smoother transitions
  return (
    <div className="animate-in fade-in duration-300">
      {hasAccess ? <>{children}</> : <>{fallback || defaultFallback}</>}
    </div>
  );
}
