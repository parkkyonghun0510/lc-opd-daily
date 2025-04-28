'use client';

import { useState, useEffect } from 'react';
import { useHybridRealtime } from './useHybridRealtime';
import { toast } from '@/components/ui/use-toast';

/**
 * Hook for dashboard-specific real-time updates
 * 
 * This hook uses the hybrid realtime approach specifically for dashboard updates.
 */
export function useDashboardRealtime(options: {
  onUpdate?: (data: any) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
} = {}) {
  const {
    onUpdate,
    autoRefresh = true,
    refreshInterval = 5 * 60 * 1000 // 5 minutes
  } = options;
  
  // State for tracking if there are new updates
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  
  // Use the hybrid realtime hook
  const {
    isConnected,
    activeMethod,
    lastEvent,
    error,
    reconnect
  } = useHybridRealtime({
    eventHandlers: {
      // Handle dashboard updates
      dashboardUpdate: (data) => {
        console.log('Received dashboard update:', data);
        
        // Set the new updates flag
        setHasNewUpdates(true);
        
        // Show a toast notification
        toast({
          title: 'Dashboard Updated',
          description: `New dashboard data is available.`,
          duration: 5000,
        });
        
        // Call the update handler if provided
        if (onUpdate) {
          onUpdate(data);
        }
        
        // Dispatch a custom event that components can listen for
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('dashboard-update', { detail: data });
          window.dispatchEvent(event);
        }
      }
    }
  });
  
  // Set up auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      // This would typically call a refresh function
      console.log('Auto-refreshing dashboard data');
      
      // In a real implementation, you would call your refresh function here
      // refreshDashboardData();
      
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);
  
  // Function to clear the new updates flag
  const clearNewUpdates = () => {
    setHasNewUpdates(false);
  };
  
  // Return the hook API
  return {
    isConnected,
    activeMethod,
    hasNewUpdates,
    clearNewUpdates,
    reconnect,
    error
  };
}
