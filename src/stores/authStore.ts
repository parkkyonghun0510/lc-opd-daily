// This file is kept for backward compatibility
// It re-exports the useAuth hook from our new authentication system
import { useAuth } from '@/auth/hooks/useAuth';
import { useStore } from '@/auth/store';

// For backward compatibility, export the store
export const useAuthStore = useStore;

// Helper hook for checking permissions
export const useAuthPermissions = () => {
  const { hasRole } = useAuth();

  return {
    hasRole,
    // Add more permission helpers as needed
  };
};
