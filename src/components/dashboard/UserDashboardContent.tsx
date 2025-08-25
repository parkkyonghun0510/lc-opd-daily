"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, TrendingUp, AlertCircle, ScrollText } from 'lucide-react';
import { DashboardCard } from './RoleBasedDashboard';
import { formatDistanceToNow } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { QuickActions } from './navigation/QuickActions';

interface UserDashboardContentProps {
    dashboardData: {
        userReports: number;
        pendingReports: number;
        growthRate: number;
        recentReports: Array<{
            id: string;
            date: string;
            branch: string;
            status: string;
            reportType: string;
            submittedAt: string;
        }>;
        recentActivities: Array<{
            description: string;
            timestamp: string;
            details: Record<string, any>;
        }>;
    };
    isLoading: boolean;
    userName?: string;
}

const UserDashboardContent: React.FC<UserDashboardContentProps> = ({
    dashboardData,
    isLoading,
    userName
}) => {
    // Memoized data destructuring to prevent unnecessary recalculations
    const memoizedData = useMemo(() => {
        const {
            userReports = 0,
            pendingReports = 0,
            growthRate = 0,
            recentReports = [],
            recentActivities = []
        } = dashboardData || {};
        
        return {
            userReports,
            pendingReports,
            growthRate,
            recentReports,
            recentActivities,
            formattedGrowthRate: `${growthRate.toFixed(1)}%`
        };
    }, [dashboardData]);

    const {
        userReports,
        pendingReports,
        growthRate,
        recentReports,
        recentActivities,
        formattedGrowthRate
    } = memoizedData;

    return (
        <div className="space-y-6">
            {/* Welcome Message */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-white">
                <h2 className="text-2xl font-semibold mb-2">
                    Welcome back, {userName || 'User'}
                </h2>
                <p className="opacity-90">
                    Here's an overview of your reporting activity and recent updates.
                </p>
            </div>

            {/* Quick Actions */}
            <QuickActions />

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-3">
                <DashboardCard
                    title="Your Reports"
                    value={userReports}
                    description="Total reports submitted by you"
                    icon={FileText}
                    isLoading={isLoading}
                />
                <DashboardCard
                    title="Pending Reports"
                    value={pendingReports}
                    description="Reports awaiting approval"
                    icon={Clock}
                    isLoading={isLoading}
                />
                <DashboardCard
                    title="Growth Rate"
                    value={formattedGrowthRate}
                    description="Report submission growth rate"
                    icon={TrendingUp}
                    isLoading={isLoading}
                />
            </div>

            {/* Recent Reports */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ScrollText className="h-5 w-5" />
                        Recent Reports
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Branch</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentReports.map((report) => (
                                    <TableRow key={report.id}>
                                        <TableCell>
                                            {new Date(report.date).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>{report.branch}</TableCell>
                                        <TableCell className="capitalize">
                                            {report.reportType.toLowerCase()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    report.status === 'approved'
                                                        ? 'default'
                                                        : report.status === 'pending'
                                                            ? 'secondary'
                                                            : 'destructive'
                                                }
                                            >
                                                {report.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Recent Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentActivities.map((activity, index) => (
                                <div
                                    key={index}
                                    className="flex items-start gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                                >
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{activity.description}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default UserDashboardContent;