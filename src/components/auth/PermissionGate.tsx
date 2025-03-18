import { ReactNode } from "react";
import { Permission, UserRole } from "@/lib/auth/roles";
import { usePermissionCheck, useRoleCheck } from "@/hooks/usePermissionCheck";

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
 * PermissionGate component controls access to UI components based on user permissions
 * It can check for specific permissions, roles, or branch access
 * 
 * @example
 * <PermissionGate
 *   permissions={[Permission.VIEW_REPORTS]}
 *   fallback={<AccessDenied />}
 * >
 *   <ReportsTable />
 * </PermissionGate>
 */
export function PermissionGate({
  children,
  fallback = null,
  permissions = [],
  requiredRole,
  requireAll = false,
  branchId,
  showLoading = true,
  loadingComponent = <div>Loading permissions...</div>,
}: PermissionGateProps) {
  // Handle permission checks
  const { 
    hasPermission, 
    isLoading: permissionsLoading, 
    error: permissionsError 
  } = usePermissionCheck(permissions, requireAll);

  // Handle role checks if required
  const { 
    hasRole, 
    isLoading: roleLoading 
  } = useRoleCheck(requiredRole || []);

  // Determine if we're still loading
  const isLoading = permissions.length > 0 ? permissionsLoading : 
    requiredRole ? roleLoading : false;

  // Show loading state if still loading
  if (isLoading && showLoading) {
    return <>{loadingComponent}</>;
  }

  // Determine if access is granted
  let hasAccess = true;

  // Check permissions if needed
  if (permissions.length > 0) {
    hasAccess = hasAccess && hasPermission;
  }

  // Check role if needed
  if (requiredRole) {
    hasAccess = hasAccess && hasRole;
  }

  // Handle error cases
  if (permissionsError && !hasAccess) {
    return <>{fallback}</>;
  }

  // Render children if access granted, otherwise fallback
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

// For backward compatibility
export const AccessControl = PermissionGate;

// Example usage:
/*
<PermissionGate
  permissions={[Permission.VIEW_REPORTS]}
  fallback={<div>You don't have permission to view this content</div>}
>
  <ReportsList />
</PermissionGate>

<PermissionGate
  permissions={[Permission.EDIT_REPORTS, Permission.REVIEW_REPORTS]}
  requireAll={true}
  branchId="branch_123"
>
  <ReportEditor />
</PermissionGate>
*/
