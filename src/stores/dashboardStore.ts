'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { fetchDashboardSummary, fetchUserDashboardData } from '@/app/_actions/dashboard-actions';
import { toast } from 'sonner';

// Cache management
const CACHE_DURATION = 60000; // 1 minute in milliseconds
const REQUEST_DEBOUNCE_TIME = 500; // 500ms debounce

// Define types for dashboard state
export interface DashboardState {
  // Data
  dashboardData: any;
  
  // Status
  isLoading: boolean;
  isInitialLoading: boolean;
  error: string | null;
  isConnected: boolean;
  connectionMethod: 'sse' | 'polling' | null;
  connectionError: string | null;
  hasNewUpdates: boolean;
  retryCount: number;
  lastUpdated: number | null;
  lastFetchTime: number | null;
  pendingRequests: Set<string>;
  optimisticUpdates: Map<string, any>;
  
  // Actions
  setDashboardData: (data: any) => void;
  setLoading: (isLoading: boolean) => void;
  setConnectionStatus: (isConnected: boolean, method?: 'sse' | 'polling' | null) => void;
  setConnectionError: (error: string | null) => void;
  setHasNewUpdates: (hasUpdates: boolean) => void;
  incrementRetryCount: () => void;
  resetRetryCount: () => void;
  clearNewUpdates: () => void;
  clearError: () => void;
  resetStore: () => void;
  addOptimisticUpdate: (key: string, data: any) => void;
  removeOptimisticUpdate: (key: string) => void;
  shouldFetch: (role: string) => boolean;
  
  // Async actions
  fetchDashboardData: (role: string, force?: boolean) => Promise<void>;
  refreshDashboardData: (role: string, force?: boolean) => Promise<void>;
}

// Create the dashboard store
export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        dashboardData: null,
        isLoading: false,
        isInitialLoading: true,
        error: null,
        isConnected: false,
        connectionMethod: null,
        connectionError: null,
        hasNewUpdates: false,
        retryCount: 0,
        lastUpdated: null,
        lastFetchTime: null,
        pendingRequests: new Set(),
        optimisticUpdates: new Map(),
        
        // Actions
        setDashboardData: (data) => set({ dashboardData: data, lastUpdated: Date.now() }),
        setLoading: (isLoading) => set({ isLoading }),
        setConnectionStatus: (isConnected, method) => set({ isConnected, connectionMethod: method || get().connectionMethod }),
        setConnectionError: (error) => set({ connectionError: error }),
        setHasNewUpdates: (hasUpdates) => set({ hasNewUpdates: hasUpdates }),
        incrementRetryCount: () => set((state) => ({ retryCount: state.retryCount + 1 })),
        resetRetryCount: () => set({ retryCount: 0 }),
        clearNewUpdates: () => set({ hasNewUpdates: false }),
        
        // Helper function to check if we should fetch data
        shouldFetch: (role) => {
          const { lastFetchTime, pendingRequests, isLoading } = get();
          const requestKey = `fetch-${role}`;
          
          // Don't fetch if already loading or request is pending
          if (isLoading || pendingRequests.has(requestKey)) {
            return false;
          }
          
          // Don't fetch if data is still fresh (within cache duration)
          if (lastFetchTime && Date.now() - lastFetchTime < CACHE_DURATION) {
            return false;
          }
          
          return true;
        },

        // Optimistic update helpers
        addOptimisticUpdate: (key, data) => {
          const optimisticUpdates = new Map(get().optimisticUpdates);
          optimisticUpdates.set(key, data);
          set({ optimisticUpdates });
        },

        removeOptimisticUpdate: (key) => {
          const optimisticUpdates = new Map(get().optimisticUpdates);
          optimisticUpdates.delete(key);
          set({ optimisticUpdates });
        },

        clearError: () => set({ error: null, connectionError: null }),
        
        resetStore: () => {
          set({
            dashboardData: null,
            isLoading: false,
            isInitialLoading: true,
            error: null,
            lastUpdated: null,
            lastFetchTime: null,
            isConnected: false,
            connectionMethod: null,
            connectionError: null,
            pendingRequests: new Set(),
            optimisticUpdates: new Map(),
            retryCount: 0
          });
        },

        // Async actions
        fetchDashboardData: async (role, force = false) => {
          const requestKey = `fetch-${role}`;
          const { pendingRequests, shouldFetch } = get();
          
          // Check if we should fetch (unless forced)
          if (!force && !shouldFetch(role)) {
            return;
          }

          // Add to pending requests
          const updatedPendingRequests = new Set(pendingRequests);
          updatedPendingRequests.add(requestKey);
          set({ 
            isLoading: true, 
            error: null,
            connectionError: null,
            pendingRequests: updatedPendingRequests
          });

          try {
            // Fetch dashboard data based on user role
            let response;
            if (role === 'ADMIN' || role === 'BRANCH_MANAGER') {
              response = await fetchDashboardSummary();
            } else {
              response = await fetchUserDashboardData();
            }
            
            if (response && (response.status === 200 || response.data)) {
              const now = Date.now();
              const finalPendingRequests = new Set(get().pendingRequests);
              finalPendingRequests.delete(requestKey);
              
              set({ 
                dashboardData: response.data || response,
                isLoading: false,
                isInitialLoading: false,
                error: null,
                connectionError: null,
                lastUpdated: now,
                lastFetchTime: now,
                retryCount: 0,
                pendingRequests: finalPendingRequests
              });
            } else {
              throw new Error(response?.error || 'No data received');
            }
          } catch (error) {
            console.error('Error fetching dashboard data:', error);
            const errorMessage = error instanceof Error ? error.message : 'Connection error';
            const finalPendingRequests = new Set(get().pendingRequests);
            finalPendingRequests.delete(requestKey);
            
            set({ 
              isLoading: false,
              error: errorMessage,
              connectionError: errorMessage,
              retryCount: get().retryCount + 1,
              pendingRequests: finalPendingRequests
            });
            
            // Only show toast for non-initial loads to avoid spam
            if (!get().isInitialLoading) {
              toast.error(`Error connecting to dashboard: ${errorMessage}`);
            }
          }
        },
        
        refreshDashboardData: async (role, force = true) => {
          // Reset retry count and clear cache when manually refreshing
          set({ 
            retryCount: 0, 
            hasNewUpdates: false,
            lastFetchTime: null // Clear cache to force refresh
          });
          await get().fetchDashboardData(role, force);
        },
      }),
      {
        name: 'dashboard-storage',
        partialize: (state) => ({
          // Only persist these fields
          dashboardData: state.dashboardData,
          lastUpdated: state.lastUpdated,
        }),
      }
    )
  )
);

// Custom hook for dashboard data with role awareness
export function useDashboardData(role: string = 'USER') {
  const {
    dashboardData,
    isLoading,
    isConnected,
    connectionMethod,
    connectionError,
    hasNewUpdates,
    retryCount,
    fetchDashboardData,
    refreshDashboardData,
    setConnectionStatus,
    setHasNewUpdates,
    clearNewUpdates,
  } = useDashboardStore();
  
  // Wrapper function that includes the role
  const fetchData = async () => {
    await fetchDashboardData(role);
  };
  
  // Wrapper function that includes the role
  const refresh = async () => {
    await refreshDashboardData(role);
  };
  
  return {
    dashboardData,
    isLoading,
    isConnected,
    connectionMethod,
    connectionError,
    hasNewUpdates,
    retryCount,
    fetchDashboardData: fetchData,
    refreshDashboardData: refresh,
    setConnectionStatus,
    setHasNewUpdates,
    clearNewUpdates,
  };
}

// Export a reconnect function for SSE
export function useReconnect() {
  return {
    reconnect: () => {
      // This is a placeholder - the actual reconnect logic will be in the SSE component
      console.log('Reconnect requested');
      // We'll dispatch a custom event that the SSE component can listen for
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sse-reconnect-requested'));
      }
      return true;
    }
  };
}
