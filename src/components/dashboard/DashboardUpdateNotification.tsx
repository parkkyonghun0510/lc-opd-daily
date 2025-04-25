'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { useHybridDashboard } from '@/contexts/HybridDashboardContext';

export default function DashboardUpdateNotification() {
  const [showNotification, setShowNotification] = useState(false);
  const { refreshDashboardData } = useHybridDashboard();

  // Listen for dashboard update events
  useEffect(() => {
    const handleDashboardUpdate = (event: CustomEvent) => {
      console.log('Dashboard update event received:', event.detail);
      setShowNotification(true);
    };

    // Add event listener
    window.addEventListener('dashboard-update', handleDashboardUpdate as EventListener);

    // Clean up
    return () => {
      window.removeEventListener('dashboard-update', handleDashboardUpdate as EventListener);
    };
  }, []);

  // Handle refresh
  const handleRefresh = () => {
    refreshDashboardData();
    setShowNotification(false);
  };

  // Don't render anything if no notification
  if (!showNotification) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 p-4 bg-yellow-50 border-yellow-200 shadow-lg max-w-sm z-50 flex items-center justify-between">
      <div className="text-sm text-yellow-800">
        Dashboard data has been updated
      </div>
      <div className="flex space-x-2">
        <Button 
          size="sm" 
          variant="outline" 
          className="text-xs h-7 px-2 border-yellow-300 hover:bg-yellow-100"
          onClick={() => setShowNotification(false)}
        >
          Dismiss
        </Button>
        <Button 
          size="sm" 
          className="text-xs h-7 px-2 bg-yellow-500 hover:bg-yellow-600 text-white"
          onClick={handleRefresh}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Refresh
        </Button>
      </div>
    </Card>
  );
}
