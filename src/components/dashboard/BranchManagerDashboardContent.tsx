"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileText, TrendingUp, Building, Award, AlertCircle, ScrollText } from 'lucide-react';
import { DashboardCard } from './RoleBasedDashboard';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QuickActions } from './navigation/QuickActions';
import { useUserData } from '@/contexts/UserDataContext';

interface BranchDashboardContentProps {
    dashboardData: {
        totalUsers: number;
        totalReports: number;
        pendingReports: number;
        totalAmount: number;
        branchName: string;
        branchStaff: number;
        branchRank: number;
        growthRate: number;
        recentReports: Array<{
            id: string;
            title: string;
            createdAt: string;
            status: string;
        }>;
    };
    isLoading: boolean;
}

const BranchManagerDashboardContent: React.FC<BranchDashboardContentProps> = ({
    dashboardData,
    isLoading
}) => {
    const {
        totalUsers = 0,
        totalReports = 0,
        pendingReports = 0,
        totalAmount = 0,
        branchName,
        branchStaff = 0,
        branchRank = 0,
        growthRate = 0,
        recentReports = []
    } = dashboardData || {};

    // Calculate performance metrics
    const reportCompletionRate = totalReports > 0
        ? ((totalReports - pendingReports) / totalReports) * 100
        : 0;

    // Format rank suffix
    const getRankSuffix = (rank: number) => {
        if (rank > 3 && rank < 21) return 'th';
        switch (rank % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };
    const { userData } = useUserData();
    const firstName = userData?.computedFields?.displayName || "";
    return (
        <div className="space-y-6">
            {/* Branch Overview Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 text-white">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-semibold mb-2">{branchName || `${firstName}`}</h2>
                        <p className="opacity-90">Branch Performance Dashboard</p>
                    </div>
                    {branchRank > 0 && (
                        <div className="text-right">
                            <p className="text-sm opacity-90">Branch Ranking</p>
                            <p className="text-3xl font-bold">
                                {branchRank}<sup>{getRankSuffix(branchRank)}</sup>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <QuickActions />

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-4">
                {/* <DashboardCard
                    title="Total Staff"
                    value={branchStaff}
                    description="Active staff members"
                    icon={Users}
                    isLoading={isLoading}
                /> */}
                <DashboardCard
                    title="Total Reports"
                    value={totalReports}
                    description="Reports submitted"
                    icon={FileText}
                    isLoading={isLoading}
                />
                <DashboardCard
                    title="Total Amount"
                    value={totalAmount}
                    description="Total writeoffs and 90+ days"
                    icon={TrendingUp}
                    isLoading={isLoading}
                />
                {/* <DashboardCard
                    title="Growth Rate"
                    value={`${growthRate}%`}
                    description="Month over month growth"
                    icon={TrendingUp}
                    isLoading={isLoading}
                    className={growthRate >= 0 ? "bg-green-50" : "bg-red-50"}
                /> */}
            </div>

            {/* Performance Metrics */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Report Completion Rate</CardTitle>
                        <CardDescription>
                            {pendingReports} reports pending approval
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span>Completion Rate</span>
                                <span className="font-medium">{reportCompletionRate.toFixed(1)}%</span>
                            </div>
                            <Progress value={reportCompletionRate} className="h-2" />
                            {pendingReports > 0 && (
                                <Alert className="mt-4">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {pendingReports} reports need your attention
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* <Card>
                    <CardHeader>
                        <CardTitle>Branch Statistics</CardTitle>
                        <CardDescription>Key performance indicators</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm">Staff Efficiency</span>
                                <span className="font-medium">
                                    {(totalReports / (branchStaff || 1)).toFixed(1)} reports/person
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm">Approval Rate</span>
                                <span className="font-medium">
                                    {((totalReports - pendingReports) / (totalReports || 1) * 100).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card> */}
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
                                    <TableHead>Report</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentReports.map((report) => (
                                    <TableRow key={report.id}>
                                        <TableCell className="font-medium">{report.title}</TableCell>
                                        <TableCell>
                                            {new Date(report.createdAt).toLocaleDateString()}
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
        </div>
    );
};

export default BranchManagerDashboardContent;