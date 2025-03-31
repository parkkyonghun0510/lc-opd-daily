export type ReportType = "plan" | "actual";

// Define ReportStatus type for consistency across the application
export type ReportStatus = "pending" | "pending_approval" | "approved" | "rejected";

export interface Report {
  id: string;
  date: string;
  branch: {
    id: string;
    code: string;
    name: string;
  };
  writeOffs: number;
  ninetyPlus: number;
  writeOffsPlan?: number;
  ninetyPlusPlan?: number;
  reportType: ReportType;
  status: ReportStatus; // Use the ReportStatus type instead of string
  submittedBy: string;
  submittedAt: string;
  updatedAt?: string;
  comments?: string;
  planReportId?: string | null;
  planReport?: Report;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
}

export interface CreateReportData {
  date: string;
  branchId: string;
  writeOffs: number;
  ninetyPlus: number;
  comments?: string;
  reportType: ReportType;
  planReportId?: string | null;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
