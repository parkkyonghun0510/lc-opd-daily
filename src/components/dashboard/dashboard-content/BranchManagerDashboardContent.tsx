import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, TrendingUp, Users, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
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

interface BranchManagerDashboardContentProps {
  dashboardData: {
    branchName?: string;
    branchStaff?: number;
    branchRank?: number;
    totalReports?: number;
    pendingReports?: number;
    totalAmount?: number;
    growthRate?: number;
    recentReports?: Array<{
      id: string;
      title: string;
      createdAt: string;
      status: string;
    }>;
  };
  isLoading: boolean;
}

const BranchManagerDashboardContent: React.FC<BranchManagerDashboardContentProps> = ({
  dashboardData,
  isLoading
}) => {
  const formatNumber = (value: number | undefined): string => {
    if (value === undefined || isNaN(value)) return 'N/A';
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  // For branch managers, we'd typically focus on their branch's data
  const branchName = dashboardData?.branchName || "Your Branch";
  const branchStaff = dashboardData?.branchStaff;
  const branchReports = dashboardData?.totalReports;
  const pendingApproval = dashboardData?.pendingReports;
  const branchRevenue = dashboardData?.totalAmount;
  const branchRank = dashboardData?.branchRank;
  const branchGrowth = dashboardData?.growthRate;
  const recentReports = dashboardData?.recentReports;

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">{branchName} Overview</h2>
        <p className="text-muted-foreground">Manage your branch operations and reports</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Branch Staff"
          value={formatNumber(branchStaff)}
          description="Active staff in your branch"
          icon={Users}
          isLoading={isLoading}
        />
        <DashboardCard
          title="Branch Reports"
          value={formatNumber(branchReports)}
          description="Total reports from your branch"
          icon={FileText}
          isLoading={isLoading}
        />
        <DashboardCard
          title="Pending Approval"
          value={formatNumber(pendingApproval)}
          description="Reports waiting for your approval"
          icon={Clock}
          isLoading={isLoading}
        />
        <DashboardCard
          title="Monthly Revenue"
          value={formatKHRCurrency(branchRevenue ?? 0)}
          description="Revenue this month"
          icon={TrendingUp}
          isLoading={isLoading}
        />
        <DashboardCard
          title="Branch Rank"
          value={branchRank || 'N/A'}
          description="Performance ranking among branches"
          icon={Building}
          isLoading={isLoading}
        />
        <DashboardCard
          title="Growth Rate"
          value={branchGrowth !== undefined ? `${branchGrowth.toFixed(2)}%` : 'N/A'}
          description="Month-over-month growth"
          icon={TrendingUp}
          isLoading={isLoading}
        />
      </div>

      {/* Quick Actions Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/reports" passHref>
            <Button>Create New Report</Button>
          </Link>
          <Link href="/dashboard/reports/pending" passHref>
            <Button variant="outline">Review Pending Reports</Button>
          </Link>
          <Link href="/dashboard/staff" passHref>
            <Button variant="outline">Manage Staff</Button>
          </Link>
        </div>
      </div>

      {/* Recent Reports Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Recent Reports</h2>
          <Link href="/dashboard/reports" passHref>
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </div>

        <div className="bg-card rounded-lg shadow p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 animate-pulse rounded w-full" />
              ))}
            </div>
          ) : recentReports && recentReports.length > 0 ? (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentReports.map((report) => (
                <li key={report.id} className="py-2 flex justify-between items-center">
                  <span className="font-medium">{report.title}</span>
                  <span className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} - {report.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Recent reports will appear here</p>
          )}
        </div>
      </div>
    </>
  );
};

export default BranchManagerDashboardContent; 