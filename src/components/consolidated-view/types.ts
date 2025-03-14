export interface Branch {
  branchId: string;
  branchCode: string;
  branchName: string;
  writeOffs: number;
  ninetyPlus: number;
  reportsCount: number;
  hasReports: boolean;
  region: string;
  size: "small" | "medium" | "large";
}

export interface HistoricalDataPoint {
  date: string;
  writeOffs: number;
  ninetyPlus: number;
  count: number;
}

export interface ConsolidatedData {
  period: {
    start: string;
    end: string;
    type: "day" | "week" | "month";
  };
  metrics: {
    totalWriteOffs: number;
    totalNinetyPlus: number;
    reportedBranches: number;
    totalBranches: number;
    coveragePercentage: number;
    previousTotalWriteOffs?: number;
    previousTotalNinetyPlus?: number;
    writeOffsChange?: number;
    ninetyPlusChange?: number;
    previousSubmissionRate?: number;
  };
  missingBranches: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  branchData: Branch[];
  historicalData: HistoricalDataPoint[];
}

export interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: Record<string, string | number | boolean>;
    dataKey?: string;
    name?: string;
    color?: string;
    value?: number;
  }>;
  label?: string;
}

export interface ChartData {
  name: string;
  writeOffs: number;
  ninetyPlus: number;
  branchId?: string;
  branchName?: string;
  hasReports?: boolean;
  reportsCount?: number;
  region?: string;
  size?: string;
  writeOffsPercentage?: string;
  ninetyPlusPercentage?: string;
  date?: string;
  rawDate?: Date | null;
  writeOffsChange?: string | null;
  ninetyPlusChange?: string | null;
  avgWriteOffs?: number;
  avgNinetyPlus?: number;
  writeOffsTrend?: "increasing" | "decreasing" | "stable";
  ninetyPlusTrend?: "increasing" | "decreasing" | "stable";
  writeOffsLastYear?: number;
  ninetyPlusLastYear?: number;
  actualWriteOffs?: number;
  planWriteOffs?: number;
  actualNinetyPlus?: number;
  planNinetyPlus?: number;
  writeOffsAchievement?: number;
  ninetyPlusAchievement?: number;
}

export interface FilterState {
  region: string;
  size: string;
  search: string;
}

export interface VisibleMetricsState {
  writeOffs: boolean;
  ninetyPlus: boolean;
}

export interface DateRangeState {
  from: Date | undefined;
  to: Date | undefined;
}

export interface CollapsedSectionsState {
  branchPerformance: boolean;
  timeSeries: boolean;
  trendAnalysis: boolean;
  [key: string]: boolean;
}
