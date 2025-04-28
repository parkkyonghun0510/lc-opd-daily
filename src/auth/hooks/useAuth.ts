"use client";

import { useAuth as useStoreAuth, useProfile } from '@/auth/store';
import { hasPermission, hasBranchAccess, debugPermissions } from '@/auth/store/actions';

/**
 * Custom hook for authentication state and actions
 */
export function useAuth() {
  return useStoreAuth();
}

/**
 * Custom hook for user profile data
 */
export function useUserProfile() {
  return useProfile();
}

/**
 * Custom hook for checking permissions
 */
export function usePermissions() {
  const { user, isAuthenticated } = useAuth();

  return {
    // Check if user has a specific permission
    hasPermission: (permission: string) => {
      if (!isAuthenticated || !user) return false;
      return hasPermission(permission);
    },

    // Check if user has any of the specified permissions
    hasAnyPermission: (permissions: string[]) => {
      if (!isAuthenticated || !user) return false;
      return permissions.some(permission => hasPermission(permission));
    },

    // Check if user has all of the specified permissions
    hasAllPermissions: (permissions: string[]) => {
      if (!isAuthenticated || !user) return false;
      return permissions.every(permission => hasPermission(permission));
    },

    // Check if user has a specific role
    hasRole: (role: string | string[]) => {
      if (!isAuthenticated || !user) return false;

      if (Array.isArray(role)) {
        return role.includes(user.role);
      }

      return user.role === role;
    },

    // Check if user has access to a specific branch
    hasBranchAccess: (branchId: string) => {
      if (!isAuthenticated || !user) return false;
      return hasBranchAccess(branchId);
    },

    // Shorthand aliases for better readability
    can: (permission: string) => hasPermission(permission),
    canAny: (permissions: string[]) => permissions.some(permission => hasPermission(permission)),
    canAll: (permissions: string[]) => permissions.every(permission => hasPermission(permission)),
    is: (role: string | string[]) => {
      if (!isAuthenticated || !user) return false;

      if (Array.isArray(role)) {
        return role.includes(user.role);
      }

      return user.role === role;
    },

    // Debug utility for permission issues
    debug: () => debugPermissions(),
  };
}
