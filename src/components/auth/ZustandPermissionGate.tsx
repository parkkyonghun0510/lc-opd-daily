import { ReactNode } from "react";
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

  // Determine if access is granted
  let hasAccess = true;

  // Check permissions if needed
  if (permissions.length > 0) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  // Check role if needed
  if (requiredRole && hasAccess) {
    hasAccess = hasRole(requiredRole);
  }

  // Check branch access if needed
  if (branchId && hasAccess) {
    hasAccess = hasBranchAccess(branchId);
  }

  // Render children if access granted, otherwise fallback
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

// Export with a more generic name for easier migration
export const PermissionGate = ZustandPermissionGate;
