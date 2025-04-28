"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Clock, ShieldCheck, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { useUserData } from '@/contexts/UserDataContext';
import { useZustandDashboard } from '@/hooks/useZustandDashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { formatKHRCurrency } from '@/lib/utils';
import BranchManagerDashboardContent from './BranchManagerDashboardContent';
import UserDashboardContent from './UserDashboardContent';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import DashboardStatusIndicator from './DashboardStatusIndicator';

// Enhanced type definitions
interface DashboardCardProps {
  title: string;
  value: string | number | undefined;
  description: string;
  icon: React.ElementType;
  isLoading: boolean;
  className?: string;
}

interface DashboardContentProps {
  dashboardData: any;
  isLoading: boolean;
  userName?: string;
}

// Reusable DashboardCard component with improved styling
const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  isLoading,
  className
}) => (
  <Card className={`shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}>
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
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {typeof value === 'number' && title.toLowerCase().includes('amount')
              ? formatKHRCurrency(value)
              : value ?? 'N/A'
            }
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </>
      )}
    </CardContent>
  </Card>
);

// Export DashboardCard for reuse
export { DashboardCard };

// Shared error component
const DashboardError: React.FC<{ error: string; onRefresh: () => void }> = ({ error, onRefresh }) => (
  <div className="container mx-auto px-4 py-8">
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error Loading Dashboard Data</AlertTitle>
      <AlertDescription>
        There was an issue fetching the latest dashboard information: {error}.
        Please try refreshing the data or contact support if the problem persists.
        <Button onClick={onRefresh} variant="secondary" size="sm" className="ml-4">
          Refresh Data
        </Button>
      </AlertDescription>
    </Alert>
  </div>
);

// Connection status component
const ConnectionStatus: React.FC<{ onReconnect: () => void }> = ({ onReconnect }) => (
  <Alert>
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Real-time Updates Disconnected</AlertTitle>
    <AlertDescription className="flex items-center justify-between">
      <span>The connection for live dashboard updates is currently inactive. Data shown might be slightly delayed.</span>
      <Button onClick={onReconnect} variant="outline" size="sm" className="ml-4">
        <RefreshCw className="h-4 w-4 mr-2" />
        Reconnect
      </Button>
    </AlertDescription>
  </Alert>
);

const RoleBasedDashboard: React.FC = () => {
  const router = useRouter();
  const { userData } = useUserData();
  const {
    dashboardData,
    isLoading,
    isConnected,
    connectionMethod,
    connectionError,
    refreshDashboardData,
    reconnect,
    hasNewUpdates: contextHasNewUpdates,
    clearNewUpdates,
    role: storeRole
  } = useZustandDashboard();

  const [hasNewUpdates, setHasNewUpdates] = useState(false);

  // Use the role from the Zustand store if available, otherwise fall back to userData
  const displayRole = storeRole || userData?.computedFields.accessLevel || 'User';

  // Redirect to role-specific dashboard
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/dashboard') {
      const roleRoutes = {
        'ADMIN': '/dashboard/admin',
        'BRANCH_MANAGER': '/dashboard/branch-manager',
        'USER': '/dashboard/user'
      };
      const targetRoute = roleRoutes[displayRole as keyof typeof roleRoutes] || '/dashboard/user';
      router.push(targetRoute);
    }
  }, [displayRole, router]);

  // Handle real-time events
  useEffect(() => {
    // When we receive a dashboard update, show a notification
    const handleDashboardUpdate = (event: CustomEvent) => {
      setHasNewUpdates(true);

      // Show a toast notification
      toast({
        title: "Dashboard Updated",
        description: `New data is available for the ${displayRole.toLowerCase()} dashboard.`,
        duration: 5000,
      });
    };

    // Add event listener
    window.addEventListener('dashboard-update', handleDashboardUpdate as EventListener);

    // Clean up
    return () => {
      window.removeEventListener('dashboard-update', handleDashboardUpdate as EventListener);
    };
  }, [displayRole]);

  // Sync hasNewUpdates with context
  useEffect(() => {
    if (contextHasNewUpdates) {
      setHasNewUpdates(true);
    }
  }, [contextHasNewUpdates]);

  // Handle refresh button click
  const handleRefresh = () => {
    setHasNewUpdates(false);
    clearNewUpdates();
    refreshDashboardData();
  };

  // Handle loading and error states
  if (connectionError) {
    return <DashboardError error={connectionError} onRefresh={refreshDashboardData} />;
  }

  if (!isConnected) {
    return <ConnectionStatus onReconnect={reconnect} />;
  }

  // We don't need to show a loading state here anymore since we're using AuthLoadingGuard

  // Define role-specific content components
  const dashboardContentMap: Record<string, React.ComponentType<DashboardContentProps>> = {
    'BRANCH_MANAGER': BranchManagerDashboardContent,
    'USER': UserDashboardContent
  };

  // Get the appropriate dashboard content component
  const DashboardContent = dashboardContentMap[displayRole] || UserDashboardContent;

  // Prepare common props for the content component
  const contentProps: DashboardContentProps = {
    dashboardData,
    isLoading,
    ...(displayRole === 'USER' && { userName: userData?.name })
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 relative">
      {/* Status indicator with absolute positioning */}
      <div className="absolute top-4 right-4 z-10">
        <DashboardStatusIndicator />
      </div>

      <div className="flex items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold capitalize">
            {displayRole.toLowerCase().replace('_', ' ')} Dashboard
          </h1>
          {hasNewUpdates && (
            <Badge variant="secondary" className="animate-pulse">
              New Updates
            </Badge>
          )}
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <Button
          onClick={handleRefresh}
          variant={hasNewUpdates ? "default" : "ghost"}
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <DashboardContent {...contentProps} />
    </div>
  );
};

export default RoleBasedDashboard;
