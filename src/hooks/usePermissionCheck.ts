import { useSession } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";
import { Permission, UserRole, checkPermission, mapToPermission } from "@/lib/auth/roles";

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
  const { data: session, status } = useSession();
  const [state, setState] = useState<PermissionState>({
    hasPermission: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (status === "loading") {
      setState({
        hasPermission: false,
        isLoading: true,
        error: null,
      });
      return;
    }

    if (status === "unauthenticated" || !session?.user) {
      setState({
        hasPermission: false,
        isLoading: false,
        error: "Not authenticated",
      });
      return;
    }

    try {
      const userRole = session.user.role as string;
      
      // Check each permission
      const results = requiredPermissions.map(permission => 
        checkPermission(userRole, permission)
      );
      
      // Determine final result based on requireAll flag
      const hasPermission = requireAll 
        ? results.every(Boolean) 
        : results.some(Boolean);
      
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
  }, [session, status, requiredPermissions, requireAll]);

  return state;
}

/**
 * Hook to check multiple permissions at once and get detailed results
 */
export function useMultiplePermissions(permissions: Permission[]) {
  const { data: session, status } = useSession();
  
  const permissionResults = useMemo(() => {
    if (status !== "authenticated" || !session?.user) {
      return permissions.reduce((acc, permission) => {
        acc[permission] = false;
        return acc;
      }, {} as Record<Permission, boolean>);
    }
    
    const userRole = session.user.role as string;
    return permissions.reduce((acc, permission) => {
      acc[permission] = checkPermission(userRole, permission);
      return acc;
    }, {} as Record<Permission, boolean>);
  }, [session, status, permissions]);
  
  return {
    permissionResults,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
  };
}

/**
 * Hook to check if user has a specific role
 */
export function useRoleCheck(role: UserRole | UserRole[]) {
  const { data: session, status } = useSession();
  
  const hasRole = useMemo(() => {
    if (status !== "authenticated" || !session?.user) {
      return false;
    }
    
    const userRole = session.user.role as string;
    return Array.isArray(role) 
      ? role.includes(userRole as UserRole)
      : userRole === role;
  }, [session, status, role]);
  
  return {
    hasRole,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
  };
}

/**
 * Use this hook to get the full permission map for the current user
 * Useful for complex UI that needs to adapt to multiple permissions
 */
export function useAllPermissions() {
  const { data: session, status } = useSession();
  
  const allPermissions = useMemo(() => {
    const defaultMap = Object.values(Permission).reduce((acc, permission) => {
      acc[permission] = false;
      return acc;
    }, {} as Record<Permission, boolean>);
    
    if (status !== "authenticated" || !session?.user) {
      return defaultMap;
    }
    
    const userRole = session.user.role as string;
    
    return Object.values(Permission).reduce((acc, permission) => {
      acc[permission] = checkPermission(userRole, permission);
      return acc;
    }, {} as Record<Permission, boolean>);
  }, [session, status]);
  
  return {
    permissions: allPermissions,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
  };
}

// Usage example:
/*
function MyProtectedComponent() {
  const { hasPermission, isLoading } = usePermissionCheck([Permission.VIEW_REPORTS]);
  
  if (isLoading) return <div>Loading...</div>;
  if (!hasPermission) return <div>Access denied</div>;
  
  return <div>Protected content</div>;
}
*/ 