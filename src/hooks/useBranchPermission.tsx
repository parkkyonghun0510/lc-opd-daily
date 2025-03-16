// src/hooks/useBranchPermission.tsx
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { BranchAccessPermission } from "@/lib/types/branch";

interface BranchPermissionResult {
  hasAccess: boolean;
  permission: BranchAccessPermission;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check if the current user has access to a specific branch
 */
export function useBranchPermission(
  branchId: string | null | undefined
): BranchPermissionResult {
  const { data: session } = useSession();
  const [result, setResult] = useState<BranchPermissionResult>({
    hasAccess: false,
    permission: BranchAccessPermission.NONE,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Reset if branchId changes
    setResult((prev) => ({ ...prev, loading: true, error: null }));

    // Don't check if no branchId or no session
    if (!branchId || !session) {
      setResult({
        hasAccess: false,
        permission: BranchAccessPermission.NONE,
        loading: false,
        error: !session ? "Not authenticated" : "No branch ID provided",
      });
      return;
    }

    const checkBranchAccess = async () => {
      try {
        const response = await fetch(`/api/branch-access?branchId=${branchId}`);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to check branch access");
        }

        const data = await response.json();

        setResult({
          hasAccess: data.hasAccess,
          permission: data.permission,
          loading: false,
          error: null,
        });
      } catch (err) {
        console.error("Error checking branch access:", err);
        setResult({
          hasAccess: false,
          permission: BranchAccessPermission.NONE,
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to check branch access",
        });
      }
    };

    checkBranchAccess();
  }, [branchId, session]);

  return result;
}

/**
 * Higher level hook that combines permission checking with branch access
 */
interface BranchActionPermissionResult extends BranchPermissionResult {
  canView: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canManage: boolean;
  canAdmin: boolean;
}

export function useBranchActionPermission(
  branchId: string | null | undefined
): BranchActionPermissionResult {
  const { hasAccess, permission, loading, error } =
    useBranchPermission(branchId);

  // Determine specific action permissions based on the permission level
  const canView =
    hasAccess &&
    [
      BranchAccessPermission.VIEW,
      BranchAccessPermission.SUBMIT,
      BranchAccessPermission.APPROVE,
      BranchAccessPermission.MANAGE,
      BranchAccessPermission.ADMIN,
    ].includes(permission);

  const canSubmit =
    hasAccess &&
    [
      BranchAccessPermission.SUBMIT,
      BranchAccessPermission.APPROVE,
      BranchAccessPermission.MANAGE,
      BranchAccessPermission.ADMIN,
    ].includes(permission);

  const canApprove =
    hasAccess &&
    [
      BranchAccessPermission.APPROVE,
      BranchAccessPermission.MANAGE,
      BranchAccessPermission.ADMIN,
    ].includes(permission);

  const canManage =
    hasAccess &&
    [BranchAccessPermission.MANAGE, BranchAccessPermission.ADMIN].includes(
      permission
    );

  const canAdmin = hasAccess && permission === BranchAccessPermission.ADMIN;

  return {
    hasAccess,
    permission,
    loading,
    error,
    canView,
    canSubmit,
    canApprove,
    canManage,
    canAdmin,
  };
}
