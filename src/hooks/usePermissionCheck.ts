// This file is kept for backward compatibility
// It re-exports the permission hooks from our new authentication system
import { usePermissions } from '@/auth/hooks/useAuth';
import { Permission, UserRole } from "@/lib/auth/roles";
import { useState, useEffect, useMemo } from "react";

interface PermissionState {
  hasPermission: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook to check if current user has specific permissions
 *
 * @param requiredPermissions Array of permissions to check
 * @param requireAll Whether all permissions are required (true) or any of them (false)
 * @returns Permission state object with loading and result
 */
export function usePermissionCheck(
  requiredPermissions: Permission[],
  requireAll: boolean = false
): PermissionState {
  const { hasPermission: checkPermission, hasAllPermissions, hasAnyPermission } = usePermissions();
  const [state, setState] = useState<PermissionState>({
    hasPermission: false,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    try {
      // Check permissions based on requireAll flag
      const hasPermission = requireAll
        ? hasAllPermissions(requiredPermissions)
        : hasAnyPermission(requiredPermissions);

      setState({
        hasPermission,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState({
        hasPermission: false,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [requiredPermissions, requireAll, hasAllPermissions, hasAnyPermission]);

  return state;
}

/**
 * Hook to check multiple permissions at once and get detailed results
 */
export function useMultiplePermissions(permissions: Permission[]) {
  const { hasPermission, isLoading } = usePermissions();

  const permissionResults = useMemo(() => {
    return permissions.reduce((acc, permission) => {
      acc[permission] = hasPermission(permission);
      return acc;
    }, {} as Record<Permission, boolean>);
  }, [permissions, hasPermission]);

  return {
    permissionResults,
    isLoading,
    isAuthenticated: !isLoading,
  };
}

/**
 * Hook to check if user has a specific role
 */
export function useRoleCheck(role: UserRole | UserRole[]) {
  const { hasRole, isLoading } = usePermissions();

  return {
    hasRole: hasRole(role),
    isLoading,
    isAuthenticated: !isLoading,
  };
}

/**
 * Use this hook to get the full permission map for the current user
 * Useful for complex UI that needs to adapt to multiple permissions
 */
export function useAllPermissions() {
  const { hasPermission, isLoading } = usePermissions();

  const allPermissions = useMemo(() => {
    return Object.values(Permission).reduce((acc, permission) => {
      acc[permission] = hasPermission(permission);
      return acc;
    }, {} as Record<Permission, boolean>);
  }, [hasPermission]);

  return {
    permissions: allPermissions,
    isLoading,
    isAuthenticated: !isLoading,
  };
}