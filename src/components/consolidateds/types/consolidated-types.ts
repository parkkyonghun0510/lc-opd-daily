"use client";

export interface Branch {
  branchId: string;
  branchCode: string;
  branchName: string;
  writeOffs: number;
  ninetyPlus: number;
  reportsCount: number;
  hasReports: boolean;
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
  };
  missingBranches: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  branchData: Branch[];
  historicalData: HistoricalDataPoint[];
}

export interface TooltipPayloadData {
  name: string;
  branchName?: string;
  branchCode?: string;
  writeOffs?: number;
  ninetyPlus?: number;
  date?: string;
  count?: number;
  writeOffsPercentage?: number;
  ninetyPlusPercentage?: number;
  hasReports?: boolean;
  writeOffsChange?: number;
  ninetyPlusChange?: number;
}

export interface TooltipPayloadItem {
  payload: TooltipPayloadData;
  name: string;
  value: number;
  dataKey: string;
  color: string;
}

export interface BranchDetailDialogProps {
  selectedBranch: string | null;
  selectedBranchData: any;
  onClose: () => void;
}

export interface ChartClickPayload {
  name?: string;
  branchName?: string;
  branchCode?: string;
  writeOffs?: number;
  ninetyPlus?: number;
  date?: string;
  count?: number;
  writeOffsPercentage?: number;
  ninetyPlusPercentage?: number;
  hasReports?: boolean;
  writeOffsChange?: number;
  ninetyPlusChange?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface ChartClickData {
  activePayload?: Array<{
    payload: ChartClickPayload;
  }>;
}

export interface TimeSeriesDataPoint {
  date: string;
  rawDate: Date | null;
  writeOffs: number;
  ninetyPlus: number;
  count: number;
  writeOffsChange: string | null;
  ninetyPlusChange: string | null;
  avgWriteOffs: number;
  avgNinetyPlus: number;
  writeOffsTrend: string;
  ninetyPlusTrend: string;
  writeOffsLastYear?: number;
  ninetyPlusLastYear?: number;
}
