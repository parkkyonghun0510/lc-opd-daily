// src/components/dashboard/layout/RoleBasedNavigation.tsx
"use client";

import { useMemo, ReactNode } from "react";
import { Permission, UserRole } from "@/lib/auth/roles";
import { useUserData, useUserPermissions } from "@/contexts/UserDataContext";
import { Skeleton } from "@/components/ui/skeleton";

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
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join("")}` as keyof typeof permissions;

      // For debugging - log the permission request and result
      //console.log(`Permission check for ${permission}: ${Boolean(permissions[permissionKey])}`);

      return permissions[permissionKey] ?? false;
    };

    const hasRole = (role: UserRole) => {
      // For debugging - log the role check
      //console.log(`Role check for ${role}: ${userData?.role === role}`);
      return userData?.role === role;
    };

    return { hasPermission, hasRole };
  }, [permissions, userData?.role]);

  // Instead of returning null during loading, show skeleton placeholders
  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  // If no user data is available, show minimal navigation options
  if (!userData) {
    console.warn("No user data available for navigation rendering");
    return (
      <div className="p-2 text-sm text-muted-foreground">
        Unable to load navigation. Please reload or login again.
      </div>
    );
  }

  // Debugging - log user role and permission data
  //console.log("User role:", userData.role);
  //console.log("User permissions:", permissions);

  return <>{children(permissionUtils)}</>;
}
