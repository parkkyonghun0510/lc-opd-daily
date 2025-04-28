'use client';

import { useHybridDashboard } from '@/contexts/HybridDashboardContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardHybridContent() {
  const {
    dashboardData,
    isLoading,
    connectionError,
    refreshDashboardData
  } = useHybridDashboard();

  // Handle loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-8 w-1/3" />
            </Card>
          ))}
        </div>
        <div className="flex justify-center items-center py-4">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading dashboard data...</span>
        </div>
      </div>
    );
  }

  // Handle error state
  if (connectionError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading dashboard</AlertTitle>
        <AlertDescription>
          <p className="mb-2">{connectionError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshDashboardData}
            className="mt-2"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Handle no data state
  if (!dashboardData) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No dashboard data</AlertTitle>
        <AlertDescription>
          <p className="mb-2">No dashboard data is available.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshDashboardData}
            className="mt-2"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Extract data from dashboardData
  const {
    totalUsers = 0,
    totalReports = 0,
    totalAmount = 0,
    growthRate = 0,
    pendingReports = 0
  } = dashboardData || {};

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Total Users</div>
          <div className="text-2xl font-bold">{totalUsers}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Total Reports</div>
          <div className="text-2xl font-bold">{totalReports}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Pending Reports</div>
          <div className="text-2xl font-bold">
            <span className={pendingReports > 0 ? 'text-amber-600' : 'text-green-600'}>
              {pendingReports}
            </span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Total Amount</div>
          <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Growth Rate</div>
          <div className="text-2xl font-bold">
            <span className={growthRate >= 0 ? 'text-green-600' : 'text-red-600'}>
              {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(2)}%
            </span>
          </div>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshDashboardData}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </>
          )}
        </Button>
        <div className="text-xs text-muted-foreground">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
