'use client';

import { HybridDashboardProvider } from '@/contexts/HybridDashboardContext';
import DashboardStatusIndicator from '@/components/dashboard/DashboardStatusIndicator';
import DashboardUpdateNotification from '@/components/dashboard/DashboardUpdateNotification';

export default function HybridDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HybridDashboardProvider>
      <div className="relative">
        {/* Status indicator in the top right */}
        <div className="absolute top-4 right-4 z-10">
          <DashboardStatusIndicator />
        </div>
        
        {/* Main content */}
        {children}
        
        {/* Update notification */}
        <DashboardUpdateNotification />
      </div>
    </HybridDashboardProvider>
  );
}
