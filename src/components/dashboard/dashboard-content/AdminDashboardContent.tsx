import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Clock, ShieldCheck, TrendingUp } from 'lucide-react';
import { formatKHRCurrency } from '@/lib/utils';

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
        <div className="h-8 w-1/2 mb-1 bg-gray-200 animate-pulse rounded" />
      ) : (
        <>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value ?? 'N/A'}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </>
      )}
    </CardContent>
  </Card>
);

interface AdminDashboardContentProps {
  dashboardData: any;
  isLoading: boolean;
}

const AdminDashboardContent: React.FC<AdminDashboardContentProps> = ({ 
  dashboardData, 
  isLoading 
}) => {
  const formatNumber = (value: number | undefined): string => {
    if (value === undefined) return 'N/A';
    return value.toLocaleString();
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Total Users"
          value={formatNumber(dashboardData?.totalUsers)}
          description="Active users in the system"
          icon={Users}
          isLoading={isLoading}
        />
        <DashboardCard
          title="Total Reports"
          value={formatNumber(dashboardData?.totalReports)}
          description="Reports across all branches"
          icon={FileText}
          isLoading={isLoading}
        />
        <DashboardCard
          title="Pending Reports"
          value={formatNumber(dashboardData?.pendingReports)}
          description="Reports awaiting approval"
          icon={Clock}
          isLoading={isLoading}
        />
        <DashboardCard
          title="Total Amount"
          value={formatKHRCurrency(dashboardData?.totalAmount ?? 0)}
          description="Amount across all actual transactions" 
          icon={TrendingUp} 
          isLoading={isLoading}
        />
        <DashboardCard
          title="Admin Users"
          value={formatNumber(dashboardData?.adminUsers)}
          description="Users with admin access"
          icon={ShieldCheck}
          isLoading={isLoading}
        />
        <DashboardCard
          title="Growth Rate"
          value={`${dashboardData?.growthRate ?? 'N/A'}%`}
          description="Month-over-month growth"
          icon={TrendingUp}
          isLoading={isLoading}
        />
      </div>

      {/* Recent Activities Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Activities</h2>
        <div className="bg-card rounded-lg shadow p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 animate-pulse rounded w-full" />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Activity log will appear here</p>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminDashboardContent; 