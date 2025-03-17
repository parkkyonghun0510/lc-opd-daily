export type ReportType = "plan" | "actual";

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
  status: string;
  submittedBy: string;
  submittedAt: string;
  comments?: string;
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
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
