import { ReactNode } from "react";
import { Permission } from "@/lib/auth/roles";
import { usePermissions } from "@/hooks/usePermissions";

interface PermissionGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  permissions?: Permission[];
  requireAll?: boolean;
  branchId?: string;
}

export function PermissionGate({
  children,
  fallback = null,
  permissions = [],
  requireAll = false,
  branchId,
}: PermissionGateProps) {
  const { canAny, canAll, canAccessBranch } = usePermissions();

  // Check branch access if branchId is provided
  if (branchId && !canAccessBranch(branchId)) {
    return <>{fallback}</>;
  }

  // Check permissions
  if (permissions.length > 0) {
    const hasPermission = requireAll
      ? canAll(permissions)
      : canAny(permissions);

    if (!hasPermission) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

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
