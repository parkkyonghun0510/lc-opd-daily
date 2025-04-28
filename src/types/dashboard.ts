export interface BranchData {
    branchName: string;
    branchStaff: number;
    branchRank: number;
    recentReports: Array<{
        id: string;
        title: string;
        createdAt: string;
        status: string;
        amount?: number;
    }>;
}

export interface DashboardSummary {
    totalUsers: number;
    totalReports: number;
    pendingReports: number;
    totalAmount: number;
    adminUsers: number;
    growthRate: number;
    customAggregations?: Record<string, number>;
    dateRange?: {
        start: string;
        end: string;
    };
}

export interface BranchManagerDashboard extends DashboardSummary {
    branchName: string;
    branchStaff: number;
    branchRank: number;
    recentReports: Array<{
        id: string;
        title: string;
        createdAt: string;
        status: string;
        amount?: number;
    }>;
}

export interface UserDashboard {
    userReports: number;
    pendingReports: number;
    growthRate: number;
    recentActivities: Array<{
        description: string;
        timestamp: string;
        details: Record<string, any>;
    }>;
    recentReports: Array<{
        id: string;
        date: string;
        branch: string;
        status: string;
        reportType: string;
        submittedAt: string;
    }>;
}