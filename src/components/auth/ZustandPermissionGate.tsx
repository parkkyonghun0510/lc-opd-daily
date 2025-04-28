import { ReactNode, useEffect, useState } from "react";
import { Permission, UserRole } from "@/lib/auth/roles";
import { usePermissions } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface PermissionGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  permissions?: Permission[];
  requiredRole?: UserRole | UserRole[];
  requireAll?: boolean;
  branchId?: string;
  showLoading?: boolean;
  loadingComponent?: ReactNode;
}

/**
 * PermissionGate component that uses Zustand for state management
 * Controls access to UI components based on user permissions
 *
 * @example
 * <PermissionGate
 *   permissions={[Permission.VIEW_REPORTS]}
 *   fallback={<AccessDenied />}
 * >
 *   <ReportsTable />
 * </PermissionGate>
 */
export function ZustandPermissionGate({
  children,
  fallback = null,
  permissions = [],
  requiredRole,
  requireAll = false,
  branchId,
  showLoading = true,
  loadingComponent = <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>,
}: PermissionGateProps) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasBranchAccess
  } = usePermissions();

  // Since usePermissions doesn't have isLoading, we'll set it to false
  const isLoading = false;

  // Track access state
  const [hasAccess, setHasAccess] = useState(false);

  // Check permissions and update access state
  useEffect(() => {
    // Start with access granted
    let accessGranted = true;

    // Check permissions if specified
    if (permissions.length > 0) {
      accessGranted = requireAll
        ? hasAllPermissions(permissions)
        : hasAnyPermission(permissions);
    }

    // Check role if specified and still has access
    if (requiredRole && accessGranted) {
      accessGranted = hasRole(requiredRole);
    }

    // Check branch access if specified and still has access
    if (branchId && accessGranted) {
      accessGranted = hasBranchAccess(branchId);
    }

    // Update access state
    setHasAccess(accessGranted);
  }, [permissions, requiredRole, requireAll, branchId, hasAllPermissions, hasAnyPermission, hasRole, hasBranchAccess]);

  // Show loading state if needed
  if (isLoading && showLoading) {
    return <>{loadingComponent}</>;
  }

  // Render children if access granted, otherwise fallback
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

// Export with a more generic name for easier migration
export const PermissionGate = ZustandPermissionGate;
