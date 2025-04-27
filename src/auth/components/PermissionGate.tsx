import { ReactNode, useEffect } from "react";
import { useStore } from "@/auth/store";
import { hasPermission, hasBranchAccess } from "@/auth/store/actions";
import { Loader2 } from "lucide-react";
import { trackAuthEvent, AuthEventType } from '@/auth/utils/analytics';

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
  loadingComponent = <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>,
}: PermissionGateProps) {
  const { isLoading, isAuthenticated, user } = useStore();

  // Show loading state if still loading
  if (isLoading && showLoading) {
    return <>{loadingComponent}</>;
  }

  // If not authenticated, show fallback
  if (!isAuthenticated || !user) {
    return <>{fallback}</>;
  }

  // Determine if access is granted
  let hasAccess = true;

  // Check permissions if needed
  if (permissions.length > 0) {
    if (requireAll) {
      // Must have all permissions
      hasAccess = permissions.every(permission => hasPermission(permission));
    } else {
      // Must have at least one permission
      hasAccess = permissions.some(permission => hasPermission(permission));
    }
  }

  // Check roles if needed
  if (roles.length > 0 && hasAccess) {
    hasAccess = roles.includes(user.role);
  }

  // Check branch access if needed
  if (branchId && hasAccess) {
    hasAccess = hasBranchAccess(branchId);
  }

  // Track permission denied events
  useEffect(() => {
    if (!hasAccess && isAuthenticated && user) {
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
  }, [hasAccess, isAuthenticated, user, permissions, roles, requireAll, branchId]);

  // Render children if access granted, otherwise fallback
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
