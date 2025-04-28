import { ReactNode, useEffect, useState } from "react";
import { useStore } from "@/stores/advanced/store";
import { hasPermission, hasBranchAccess } from "@/stores/advanced/actions";
import { Loader2 } from "lucide-react";

interface AdvancedPermissionGateProps {
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
 * AdvancedPermissionGate component
 *
 * Controls access to UI components based on user permissions and roles.
 * Uses the advanced Zustand store for state management.
 *
 * @example
 * <AdvancedPermissionGate
 *   permissions={["VIEW_REPORTS"]}
 *   fallback={<AccessDenied />}
 * >
 *   <ReportsTable />
 * </AdvancedPermissionGate>
 */
export function AdvancedPermissionGate({
  children,
  fallback = null,
  permissions = [],
  roles = [],
  requireAll = false,
  branchId,
  showLoading = true,
  loadingComponent = <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>,
}: AdvancedPermissionGateProps) {
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
  }, [isAuthenticated, user, permissions, roles, requireAll, branchId]);

  // Show loading state if needed
  if (isLoading && showLoading) {
    return <>{loadingComponent}</>;
  }

  // Render children if access granted, otherwise fallback
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

// Export with a more generic name for easier migration
export const PermissionGate = AdvancedPermissionGate;
