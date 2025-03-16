// src/components/auth/BranchPermissionGate.tsx
import { ReactNode } from "react";
import { Permission } from "@/lib/auth/roles";
import { usePermissions } from "@/hooks/usePermissions";
import { useBranchActionPermission } from "@/hooks/useBranchPermission";
import { Loader2 } from "lucide-react";

interface BranchPermissionGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  branchId: string;
  permissions?: Permission[];
  requireAll?: boolean;
  showLoading?: boolean;
}

export function BranchPermissionGate({
  children,
  fallback = null,
  branchId,
  permissions = [],
  requireAll = false,
  showLoading = false,
}: BranchPermissionGateProps) {
  const { canAny, canAll } = usePermissions();
  const { hasAccess, loading } = useBranchActionPermission(branchId);

  // Show loading state
  if (loading && showLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // First check if user can access this branch
  if (!hasAccess) {
    return <>{fallback}</>;
  }

  // Then check specific permissions
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
<BranchPermissionGate branchId="branch_123" permissions={[Permission.VIEW_REPORTS]}>
  <ReportsList />
</BranchPermissionGate>
*/
