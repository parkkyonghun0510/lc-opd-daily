import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { logger, performanceLogger } from './middleware/logger';
import { createAuthSlice, AuthSlice } from './slices/authSlice';
import { createProfileSlice, ProfileSlice } from './slices/profileSlice';
import { createHybridRealtimeSlice, HybridRealtimeSlice } from './slices/hybridRealtimeSlice';
import { devtools } from 'zustand/middleware';

// Define the combined store type
export interface StoreState extends AuthSlice, ProfileSlice, HybridRealtimeSlice { }

// Create the combined store
export const useStore = create<StoreState>()(
  devtools(
    persist(
      // Temporarily disable logger and performanceLogger for build
      // logger(
      //   performanceLogger(
      (...a) => ({
        // Combine the slices
        ...createAuthSlice(...a),
        ...createProfileSlice(...a),
        ...createHybridRealtimeSlice(...a),
      }),
      //     'auth-store'
      //   )
      // ),
      {
        name: 'auth-storage', // Name for localStorage
        storage: createJSONStorage(() => localStorage), // Use localStorage
        // Only persist these fields
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          profile: state.profile,
          lastFetchTime: state.lastFetchTime,
          sessionExpiresAt: state.sessionExpiresAt,
          refreshToken: state.refreshToken,
          tokenExpiresAt: state.tokenExpiresAt,
        }),
      }
    )
  )
);

// Create custom hooks for each slice
export const useAuth = () => {
  const store = useStore();

  return {
    // Auth state
    user: store.user,
    isLoading: store.isLoading,
    isAuthenticated: store.isAuthenticated,
    error: store.error,
    refreshToken: store.refreshToken,
    refreshInProgress: store.refreshInProgress,

    // Auth actions
    login: store.login,
    logout: store.logout,
    setUser: store.setUser,
    clearError: store.clearError,
    setLoading: store.setLoading,
    updateLastActivity: store.updateLastActivity,
    refreshAuthToken: store.refreshAuthToken, // Use only one name for the refresh token function
    silentRefresh: store.silentRefresh,

    // Auth selectors
    isAdmin: store.isAdmin,
    isBranchManager: store.isBranchManager,
    isSessionExpired: store.isSessionExpired,
    isTokenExpired: store.isTokenExpired,
    timeUntilExpiry: store.timeUntilExpiry,
    timeUntilTokenExpiry: store.timeUntilTokenExpiry,
    inactivityTime: store.inactivityTime,
    needsTokenRefresh: store.needsTokenRefresh,
  };
};

export const useProfile = () => {
  const store = useStore();

  return {
    // Profile state
    profile: store.profile,
    isLoading: store.isLoading,
    error: store.error,

    // Profile actions
    fetchProfile: store.fetchProfile,
    setProfile: store.setProfile,
    updateProfile: store.updateProfile,
    updatePreferences: store.updatePreferences,
    clearProfile: store.clearProfile,

    // Profile selectors
    needsRefresh: store.needsRefresh,
    displayName: store.displayName,
    formattedRole: store.formattedRole,
    initials: store.initials,
    hasBranch: store.hasBranch,
    branchName: store.branchName,
  };
};

// SSE hook removed in favor of HybridRealtime

export const useHybridRealtime = () => {
  const store = useStore();

  return {
    // State
    isConnected: store.isConnected,
    activeMethod: store.activeMethod,
    lastEvent: store.lastEvent,
    error: store.error,
    connectionStatus: store.connectionStatus,

    // Actions
    connect: (options?: any) => {
      // Add user ID to client metadata if available
      if (store.user?.id) {
        const updatedOptions = {
          ...options,
          clientMetadata: {
            ...(options?.clientMetadata || {}),
            userId: store.user.id,
            role: store.user.role || 'user'
          }
        };
        store.connect(updatedOptions);
      } else {
        store.connect(options);
      }
    },
    disconnect: store.disconnect,
    reconnect: store.reconnect,
    scheduleReconnect: store.scheduleReconnect,
    setOptions: store.setOptions,

    // Event handlers
    handleOnline: store.handleOnline,
    handleOffline: store.handleOffline,

    // Event handling
    processEvent: store.processEvent,
    cacheEvent: store.cacheEvent,
    loadCachedEvents: store.loadCachedEvents,

    // Smart polling
    enableActivePolling: store.enableActivePolling,
    checkPollingStatus: store.checkPollingStatus,

    // Selectors
    getOptions: store.getOptions,
    isSSESupported: store.isSSESupported,
    getCachedEvents: store.getCachedEvents,
    getConnectionStatus: store.getConnectionStatus,
    getLastReconnectTime: store.getLastReconnectTime,
    getReconnectAttempts: store.getReconnectAttempts,
    getTimeSinceLastEvent: store.getTimeSinceLastEvent,
    shouldReconnect: store.shouldReconnect,
    isPollingActive: store.isPollingActive,
    getTimeSinceLastAction: store.getTimeSinceLastAction
  };
};
