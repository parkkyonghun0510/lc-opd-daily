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
  const { data: session, status } = useSession();
  const [result, setResult] = useState<BranchPermissionResult>({
    hasAccess: false,
    permission: BranchAccessPermission.NONE,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // If session is loading, wait
    if (status === 'loading') {
      return;
    }

    // Debug log
    console.log("useBranchPermission checking for branchId:", branchId);
    console.log("User session:", session?.user);

    // Reset if branchId changes
    setResult((prev) => ({ ...prev, loading: true, error: null }));

    // Special case for admins - they should always have access
    if (session?.user?.role === 'ADMIN') {
      console.log("Admin user detected - granting full access regardless of branch");
      setResult({
        hasAccess: true,
        permission: BranchAccessPermission.ADMIN,
        loading: false,
        error: null,
      });
      return;
    }

    // Don't check if no branchId or no session
    if (!branchId || !session) {
      const errorMsg = !session ? "Not authenticated" : "No branch ID provided";
      console.log("Branch permission error:", errorMsg);
      
      setResult({
        hasAccess: false,
        permission: BranchAccessPermission.NONE,
        loading: false,
        error: errorMsg,
      });
      return;
    }

    const checkBranchAccess = async () => {
      try {
        console.log("Fetching branch access for:", branchId);
        const response = await fetch(`/api/branch-access?branchId=${branchId}`);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to check branch access");
        }

        const data = await response.json();
        console.log("Branch access response:", data);

        // Determine permission level based on user role
        let permission = BranchAccessPermission.NONE;
        if (data.hasAccess) {
          switch (session.user?.role) {
            case "ADMIN":
              permission = BranchAccessPermission.ADMIN;
              break;
            case "BRANCH_MANAGER":
              permission = BranchAccessPermission.MANAGE;
              break;
            case "SUPERVISOR":
              permission = BranchAccessPermission.APPROVE;
              break;
            case "USER":
              permission = BranchAccessPermission.SUBMIT;
              break;
            default:
              permission = BranchAccessPermission.NONE;
          }
        }

        console.log("Final branch permission:", permission);
        setResult({
          hasAccess: data.hasAccess,
          permission,
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

    // For users with assigned branch matching the current branch, 
    // grant access without API call
    if (session.user?.branchId === branchId) {
      console.log("User's assigned branch matches requested branch - granting access");
      
      let permission = BranchAccessPermission.NONE;
      switch (session.user?.role) {
        case "ADMIN":
          permission = BranchAccessPermission.ADMIN;
          break;
        case "BRANCH_MANAGER":
          permission = BranchAccessPermission.MANAGE;
          break;
        case "SUPERVISOR":
          permission = BranchAccessPermission.APPROVE;
          break;
        case "USER":
          permission = BranchAccessPermission.SUBMIT;
          break;
        default:
          permission = BranchAccessPermission.NONE;
      }
      
      setResult({
        hasAccess: true,
        permission,
        loading: false,
        error: null,
      });
      return;
    }

    checkBranchAccess();
  }, [branchId, session, status]);

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
