"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Clock, ShieldCheck, TrendingUp, AlertCircle } from 'lucide-react';
import { useUserData } from '@/contexts/UserDataContext';
import { useDashboardData } from '@/contexts/DashboardDataContext'; // Import the hook
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatKHRCurrency } from '@/lib/utils';
import AdminDashboardContent from './dashboard-content/AdminDashboardContent';
import BranchManagerDashboardContent from './dashboard-content/BranchManagerDashboardContent';
import UserDashboardContent from './dashboard-content/UserDashboardContent';
// import { formatNumber } from '@/utils/formatters'; // Assuming you have a number formatter

// Define a type for the dashboard card props
interface DashboardCardProps {
  title: string;
  value: string | number | undefined;
  description: string;
  icon: React.ElementType;
  isLoading: boolean;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, description, icon: Icon, isLoading }) => (
  <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <>
          <Skeleton className="h-8 w-1/2 mb-1" />
          <Skeleton className="h-4 w-3/4" />
        </>
      ) : (
        <>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value ?? 'N/A'}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </>
      )}
    </CardContent>
  </Card>
);

// Define a type for the dashboard component props if needed
interface RoleBasedDashboardProps {
  // Add any props if necessary
}

const RoleBasedDashboard: React.FC<RoleBasedDashboardProps> = () => {
  const router = useRouter();
  const { userData } = useUserData();
  const { dashboardData, isLoading, isSseConnected, sseError, refreshDashboardData } = useDashboardData(); // Use the hook

  // Determine the role for display
  const displayRole = userData?.computedFields.accessLevel || 'User';
  
  React.useEffect(() => {
    // If we're on the generic dashboard route, redirect to the role-specific one
    // This works with the middleware but provides a fallback in case middleware doesn't run
    // (such as during development or static generation)
    if (typeof window !== 'undefined' && window.location.pathname === '/dashboard') {
      if (displayRole === 'ADMIN') {
        router.push('/dashboard/admin');
      } else if (displayRole === 'BRANCH_MANAGER') {
        router.push('/dashboard/branch-manager');
      } else {
        router.push('/dashboard/user');
      }
    }
  }, [displayRole, router]);

  // Handle loading state
  const cardIsLoading = isLoading || !dashboardData;

  // Handle error state
  if (sseError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Dashboard Data</AlertTitle>
          <AlertDescription>
            There was an issue fetching the latest dashboard information: {sseError}.
            Please try refreshing the data or contact support if the problem persists.
            <Button onClick={refreshDashboardData} variant="secondary" size="sm" className="ml-4">
              Refresh Data
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isSseConnected) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Real-time Updates Disconnected</AlertTitle>
        <AlertDescription>
          The connection for live dashboard updates is currently inactive. Data shown might be slightly delayed.
        </AlertDescription>
      </Alert>
    );
  }

  // Define a mapping of roles to their corresponding dashboard content components
  const dashboardContentMap: {
    [key: string]: React.ComponentType<any>
  } = {
    // 'ADMIN': AdminDashboardContent,
    'BRANCH_MANAGER': BranchManagerDashboardContent,
    // Default to UserDashboardContent for any other role
  };

  // Get the appropriate dashboard content component based on role
  const DashboardContent = dashboardContentMap[displayRole] || UserDashboardContent;
  
  // Create props object based on role
  const contentProps = {
    dashboardData,
    isLoading: cardIsLoading,
    ...(displayRole !== 'ADMIN' && displayRole !== 'BRANCH_MANAGER' ? { userName: userData?.name } : {})
  };

  // Use component composition rather than conditional rendering
  // This makes it easy to add shared UI elements across all dashboard types
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Common dashboard elements for all users */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{displayRole} Dashboard</h1>
        <div className="space-x-2">
          
          {/* <Link href="/dashboard/consolidated" passHref>
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" /> Consolidated View
            </Button>
          </Link> */}
          <Button onClick={refreshDashboardData} variant="ghost" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Render the appropriate dashboard content based on role */}
      <DashboardContent 
        {...contentProps}
      />
    </div>
  );
};

export default RoleBasedDashboard;
