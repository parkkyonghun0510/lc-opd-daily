import React from 'react';
import RoleBasedDashboard from '@/components/dashboard/RoleBasedDashboard';
import { DashboardDataProvider } from '@/contexts/DashboardDataContext';

export default function UserDashboardPage() {
  return (
    <DashboardDataProvider>
      <RoleBasedDashboard />
    </DashboardDataProvider>
  );
} 