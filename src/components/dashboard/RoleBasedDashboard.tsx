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
import { formatKHRCurrency } from '@/lib/utils';
import AdminDashboard from '@/app/(dashboard)/dashboard/admin/page';
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
  const { userData } = useUserData();
  const { dashboardData, isLoading, isSseConnected, sseError, refreshDashboardData } = useDashboardData(); // Use the hook

  // Determine the role for display
  const displayRole = userData?.computedFields.accessLevel || 'User';

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

  // switch (displayRole) {
  //   case 'ADMIN':
  //     return <AdminDashboard />;
  //   case 'BRANCH_MANAGER':
  //     return <BranchManagerDashboard />;
  //   default:
  //     return <UserDashboard />;
  // }
  // Render based on role
  if (displayRole === 'ADMIN') {
    function formatNumber(totalUsers: number | undefined): string {
      if (totalUsers === undefined) return 'N/A';
      return totalUsers.toLocaleString();
    }

    // Admin Dashboard View
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        {!isSseConnected && (
           <Alert >
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Real-time Updates Disconnected</AlertTitle>
             <AlertDescription>
               The connection for live dashboard updates is currently inactive. Data shown might be slightly delayed.
             </AlertDescription>
           </Alert>
        )}
        <Link href="/dashboard/consolidated" passHref>
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" /> Consolidated View
            </Button>
        </Link>
    
        {/* <AdminDashboard /> */}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Total Users"
            value={formatNumber(dashboardData?.totalUsers)}
            description="Active users in the system"
            icon={Users}
            isLoading={cardIsLoading}
          />
          <DashboardCard
            title="Total Reports"
            value={formatNumber(dashboardData?.totalReports)}
            description="Reports across all branches"
            icon={FileText}
            isLoading={cardIsLoading}
          />
          <DashboardCard
            title="Pending Reports"
            value={formatNumber(dashboardData?.pendingReports)}
            description="Reports awaiting approval"
            icon={Clock}
            isLoading={cardIsLoading}
          />
          <DashboardCard
            title="Total Amount"
            // Assuming totalAmount is already formatted if needed, or format here
            value={`${ formatKHRCurrency(dashboardData?.totalAmount ?? 0)}`}
            description="Amount across all actual transactions" icon={TrendingUp} isLoading={false}          />
          <DashboardCard
            title="Admin Users"
            value={formatNumber(dashboardData?.adminUsers)}
            description="Users with admin access"
            icon={ShieldCheck}
            isLoading={cardIsLoading}
          />
          <DashboardCard
            title="Growth Rate"
            value={`${dashboardData?.growthRate ?? 'N/A'}%`}
            description="Month-over-month growth (placeholder)"
            icon={TrendingUp}
            isLoading={cardIsLoading}
          />
        </div>

        {/* Add other admin-specific components or sections here */}
        {/* Example: Recent Activity Feed, Quick Links, etc. */}

      </div>
    );
  } else {
    // Standard User Dashboard View (or Branch Manager, etc.)
    // You might fetch different data or display different cards here
    
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{displayRole.replace('_', ' ').trim()}</h2>
        <p className="text-muted-foreground">Overview of your assigned branch operations</p>

        {/* Add user-specific dashboard components here */}
        <p>Welcome, {userData?.name}!</p>
        {/* Example: Display reports for user's branch, pending actions, etc. */}
        <div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          <Link href="/dashboard/reports" passHref>
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" /> Reports View
            </Button>
          </Link>
          </div>
        
      <DashboardCard
            title="Total Reports"
            value={dashboardData?.totalReports}
            description="Reports across all branches"
            icon={FileText}
            isLoading={cardIsLoading}
          />
          <DashboardCard
            title="Growth Rate"
            value={`${dashboardData?.growthRate ?? 'N/A'}%`}
            description="Month-over-month growth (placeholder)"
            icon={TrendingUp}
            isLoading={cardIsLoading}
          />
          <DashboardCard
            title="Pending Reports"
            value={dashboardData?.pendingReports}
            description="Reports awaiting approval"
            icon={Clock}
            isLoading={cardIsLoading}
          />
    </div>
      </div>
    );
  }
};

export default RoleBasedDashboard;
