// src/components/auth/BranchPermissionGate.tsx
import { ReactNode, useEffect, useState } from "react";
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
  const { hasAccess: branchAccess, loading } =
    useBranchActionPermission(branchId);

  // Track access state
  const [hasAccess, setHasAccess] = useState(false);

  // Check permissions and update access state
  useEffect(() => {
    // Skip if still loading
    if (loading) {
      return;
    }

    // First check if user can access this branch
    if (!branchAccess) {
      setHasAccess(false);
      return;
    }

    // Then check specific permissions
    if (permissions.length > 0) {
      const hasPermission = requireAll
        ? canAll(permissions)
        : canAny(permissions);

      setHasAccess(hasPermission);
    } else {
      // If no permissions specified, just check branch access
      setHasAccess(branchAccess);
    }
  }, [branchAccess, loading, permissions, requireAll, canAll, canAny]);

  // Show loading state
  if (loading && showLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Render based on access state
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

// Example usage:
/*
<BranchPermissionGate branchId="branch_123" permissions={[Permission.VIEW_REPORTS]}>
  <ReportsList />
</BranchPermissionGate>
*/
