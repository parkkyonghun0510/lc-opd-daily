// src/components/dashboard/layout/RoleBasedNavigation.tsx
"use client";

import { useMemo, ReactNode } from "react";
import { Permission, UserRole } from "@/lib/auth/roles";
import { useUserData, useUserPermissions } from "@/contexts/UserDataContext";

interface RoleBasedNavigationProps {
  children: (props: {
    hasPermission: (permission: Permission) => boolean;
    hasRole: (role: UserRole) => boolean;
  }) => ReactNode;
}

export function RoleBasedNavigation({ children }: RoleBasedNavigationProps) {
  const { userData, isLoading } = useUserData();
  const permissions = useUserPermissions();

  // Memoize the permission checking functions to prevent unnecessary rerenders
  const permissionUtils = useMemo(() => {
    const hasPermission = (permission: Permission) => {
      const permissionKey = `can${permission
        .split("_")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join("")}` as keyof typeof permissions;
      return permissions[permissionKey] ?? false;
    };

    const hasRole = (role: UserRole) => {
      return userData?.role === role;
    };

    return { hasPermission, hasRole };
  }, [permissions, userData?.role]);

  if (isLoading || !userData) {
    return null;
  }

  return <>{children(permissionUtils)}</>;
}
