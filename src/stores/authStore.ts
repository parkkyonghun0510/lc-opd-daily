// This file is kept for backward compatibility
// It re-exports the useAuth hook from our new authentication system
import { useAuth } from '@/auth/hooks/useAuth';
import { useStore } from '@/auth/store';

// For backward compatibility, export the store
export const useAuthStore = useStore;

// Helper hook for checking permissions
export const useAuthPermissions = () => {
  const auth = useAuth();

  return {
    hasRole: (role: string | string[]) => {
      if (!auth.isAuthenticated || !auth.user) return false;

      if (Array.isArray(role)) {
        return role.includes(auth.user.role);
      }

      return auth.user.role === role;
    },
    // Add more permission helpers as needed
  };
};
