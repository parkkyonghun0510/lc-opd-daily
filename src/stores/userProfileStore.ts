// This file is kept for backward compatibility
// It re-exports the useUserProfile hook from our new authentication system
export { useUserProfile } from '@/auth/hooks/useAuth';

// For backward compatibility, also export the store
import { useStore } from '@/auth/store';
export const useUserProfileStore = useStore;
