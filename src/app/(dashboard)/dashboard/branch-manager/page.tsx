import React from 'react';
import RoleBasedDashboard from '@/components/dashboard/RoleBasedDashboard';
import { DashboardDataProvider } from '@/contexts/DashboardDataContext';

export default function BranchManagerDashboardPage() {
  return (
    <DashboardDataProvider>
      <RoleBasedDashboard />
    </DashboardDataProvider>
  );
} 