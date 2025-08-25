"use client";

import React, { useEffect, useState, useMemo, Suspense } from 'react';
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
import { toast } from 'sonner';
import DashboardStatusIndicator from './DashboardStatusIndicator';

// Loading skeleton component for better UX
const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  </div>
);

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
  const { userData, isLoading: userLoading, error: userError } = useUserData();
  const {
    dashboardData,
    isLoading,
    isInitialLoading,
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

  // Memoized condition checks for better performance
  const canShowDashboard = useMemo(() => {
    return userData && !userLoading && !userError;
  }, [userData, userLoading, userError]);

  const shouldShowLoading = useMemo(() => {
    return userLoading || (isInitialLoading && !dashboardData);
  }, [userLoading, isInitialLoading, dashboardData]);

  const hasError = useMemo(() => {
    return userError || connectionError;
  }, [userError, connectionError]);

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

  // Handle connection status changes with debouncing
  useEffect(() => {
    if (connectionError && !isLoading && !isInitialLoading) {
      const timeoutId = setTimeout(() => {
        toast.error(`Dashboard Error: ${connectionError}`);
      }, 1000); // Debounce error notifications
      
      return () => clearTimeout(timeoutId);
    }
  }, [connectionError, isLoading, isInitialLoading]);

  // Show loading state with skeleton
  if (shouldShowLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm text-gray-600">Loading dashboard...</span>
          </div>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  // Show error state with retry option
  if (hasError && !canShowDashboard) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Dashboard Error</h3>
            <p className="text-sm text-gray-600 mt-1">{hasError}</p>
          </div>
          <button
            onClick={() => {
              if (reconnect) {
                reconnect();
              } else {
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  // Handle loading and error states
  if (connectionError) {
    return <DashboardError error={connectionError} onRefresh={refreshDashboardData} />;
  }

  if (!isConnected) {
    return <ConnectionStatus onReconnect={reconnect} />;
  }

  // Don't render if conditions aren't met
  if (!canShowDashboard) {
    return null;
  }

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

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent {...contentProps} />
      </Suspense>
    </div>
  );
};

export default RoleBasedDashboard;
