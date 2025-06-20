import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface DashboardCardProps {
  title: string;
  value: string | number | undefined;
  description: string;
  icon: React.ElementType;
  isLoading: boolean;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  isLoading,
}) => (
  <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
        {title}
      </CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="h-8 w-1/2 mb-1 bg-gray-200 animate-pulse rounded" />
      ) : (
        <>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {value ?? "N/A"}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </>
      )}
    </CardContent>
  </Card>
);

interface UserDashboardContentProps {
  dashboardData: any;
  isLoading: boolean;
  userName?: string;
}

const UserDashboardContent: React.FC<UserDashboardContentProps> = ({
  dashboardData,
  isLoading,
  userName,
}) => {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">
          Welcome{userName ? `, ${userName}` : ""}!
        </h2>
        <p className="text-muted-foreground">
          Overview of your assigned branch operations
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="My Reports"
          value={dashboardData?.userReports}
          description="Reports you have created"
          icon={FileText}
          isLoading={isLoading}
        />
        <DashboardCard
          title="Pending Approval"
          value={dashboardData?.pendingReports}
          description="Reports awaiting approval"
          icon={Clock}
          isLoading={isLoading}
        />
        {/* <DashboardCard
          title="Growth Rate"
          value={`${dashboardData?.growthRate ?? 'N/A'}%`}
          description="Month-over-month growth"
          icon={TrendingUp}
          isLoading={isLoading}
        /> */}
      </div>

      {/* Quick Actions Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/reports/new" passHref>
            <Button>Create New Report</Button>
          </Link>
          <Link href="/dashboard/reports" passHref>
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" /> View Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Recent Reports</h2>
          <Link href="/dashboard/reports" passHref>
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </div>

        <div className="bg-card rounded-lg shadow p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-6 bg-gray-200 animate-pulse rounded w-full"
                />
              ))}
            </div>
          ) : dashboardData?.recentReports?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs">
                    <th className="px-2 py-1 text-left">Date</th>
                    <th className="px-2 py-1 text-left">Branch</th>
                    <th className="px-2 py-1 text-left">Status</th>
                    <th className="px-2 py-1 text-left">Type</th>
                    {/* <th className="px-2 py-1 text-left">Action</th> */}
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.recentReports.map(
                    (report: any, index: number) => (
                      <tr
                        key={report.id || index}
                        className="border-b last:border-0"
                      >
                        <td className="px-2 py-1">
                          {report.date
                            ? new Date(report.date).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-2 py-1">{report.branch}</td>
                        <td className="px-2 py-1 capitalize">
                          {report.status}
                        </td>
                        <td className="px-2 py-1 capitalize">
                          {report.reportType}
                        </td>
                        {/* <td className="px-2 py-1">
                          {report.id ? (
                            <Link href={`/dashboard/reports/${report.id}`} passHref>
                              <Button variant="link" size="sm">View</Button>
                            </Link>
                          ) : null}
                        </td> */}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground">
              No recent reports to display
            </p>
          )}
        </div>
      </div>

      {/* Upcoming Tasks */}
      {/* <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Upcoming Tasks</h2>
        <div className="bg-card rounded-lg shadow p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 animate-pulse rounded w-full" />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No upcoming tasks scheduled</p>
          )}
        </div>
      </div> */}
    </>
  );
};

export default UserDashboardContent;
