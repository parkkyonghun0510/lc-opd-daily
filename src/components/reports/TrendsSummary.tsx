"use client";

import { formatKHRCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus, BarChart2, Building, Calendar, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TrendsSummaryProps {
    trends: {
        writeOffs: {
            average: number;
            trend: number;
            direction: "up" | "down" | "stable";
        };
        ninetyPlus: {
            average: number;
            trend: number;
            direction: "up" | "down" | "stable";
        };
        branchPerformance: Array<{
            branchId: string;
            averageWriteOffs: number;
            averageNinetyPlus: number;
            reportCount: number;
        }>;
    };
    formatCurrency?: (amount: number) => string;
    className?: string;
    // New properties for totals
    totalWriteOffs?: number;
    totalNinetyPlus?: number;
    dateRange?: {
        start?: Date;
        end?: Date;
    };
    reportCount?: number;
}

// Default format currency function if none is provided
export const defaultFormatCurrency = (amount: number): string => {
    return formatKHRCurrency(amount);
};

export function TrendsSummary({
    trends,
    formatCurrency = defaultFormatCurrency,
    className,
    totalWriteOffs = 0,
    totalNinetyPlus = 0,
    dateRange,
    reportCount = 0
}: TrendsSummaryProps) {
    // Format date range for display
    const formatDateRange = () => {
        if (!dateRange) return "All time";

        const startDate = dateRange.start ? format(dateRange.start, "MMM d, yyyy") : "Start";
        const endDate = dateRange.end ? format(dateRange.end, "MMM d, yyyy") : "Present";

        return `${startDate} - ${endDate}`;
    };

    const getTrendIcon = (direction: "up" | "down" | "stable") => {
        switch (direction) {
            case "up":
                return <TrendingUp className="h-4 w-4 text-red-500" />;
            case "down":
                return <TrendingDown className="h-4 w-4 text-green-500" />;
            default:
                return <Minus className="h-4 w-4 text-gray-500" />;
        }
    };

    const getTrendColor = (direction: "up" | "down" | "stable") => {
        switch (direction) {
            case "up":
                return "text-red-500";
            case "down":
                return "text-green-500";
            default:
                return "text-gray-500";
        }
    };

    return (
        <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-4", className)}>
            {/* Total Summary Card */}
            <Card className="md:col-span-2 lg:col-span-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Summary</CardTitle>
                    <div className="flex items-center text-xs text-gray-500">
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        <span>{formatDateRange()}</span>
                        {reportCount > 0 && (
                            <span className="ml-2 flex items-center">
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                {reportCount} reports
                            </span>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Write-offs</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalWriteOffs)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total 90+ Days</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalNinetyPlus)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Write-offs Trend Card */}
            {/* <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Write-offs Trend</CardTitle>
                    {getTrendIcon(trends.writeOffs.direction)}
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatCurrency(trends.writeOffs.average)}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                        <p className={cn(
                            "text-sm font-medium",
                            getTrendColor(trends.writeOffs.direction)
                        )}>
                            {trends.writeOffs.trend.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">avg. change</p>
                    </div>
                </CardContent>
            </Card> */}

            {/* 90+ Days Trend Card */}
            {/* <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">90+ Days Trend</CardTitle>
                    {getTrendIcon(trends.ninetyPlus.direction)}
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatCurrency(trends.ninetyPlus.average)}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                        <p className={cn(
                            "text-sm font-medium",
                            getTrendColor(trends.ninetyPlus.direction)
                        )}>
                            {trends.ninetyPlus.trend.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">avg. change</p>
                    </div>
                </CardContent>
            </Card> */}

            {/* Branch Performance Card */}
            {/* <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Top Branches</CardTitle>
                    <Building className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {trends.branchPerformance.length > 0 ? (
                            trends.branchPerformance.map((branch, index) => (
                                <div
                                    key={branch.branchId}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <span className="truncate flex-1" title={`Branch ${branch.branchId}`}>
                                        Branch {branch.branchId}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <BarChart2 className="h-3 w-3 text-gray-400" />
                                        <span className="text-gray-900 dark:text-gray-100 font-medium">
                                            {formatCurrency(branch.averageWriteOffs)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500">No branch data available</p>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Average write-offs by branch</p>
                </CardContent>
            </Card> */}
        </div>
    );
}
