export type ReportType = "plan" | "actual";

// Define ReportStatus type for consistency across the application
export type ReportStatus =
  | "pending"
  | "pending_approval"
  | "approved"
  | "rejected";

// Define comment types (legacy - use ReportCommentType instead)
// @deprecated Use ReportCommentType instead
export interface CommentItem {
  id: string;
  type: "comment" | "resubmission" | "rejection" | "reply";
  text: string;
  timestamp: string;
  userId: string;
  userName: string;
  parentId?: string; // Reference to parent comment for replies
  replies?: CommentItem[]; // Array of reply comments
  edited?: boolean; // Whether the comment has been edited
  editedAt?: string; // When the comment was last edited
}

export interface Report {
  user: any;
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
  // Legacy fields - marked as deprecated
  comments?: string; // @deprecated Use ReportComment model instead
  planReportId?: string | null;
  planReport?: Report;
  // ReportComment relation
  ReportComment?: ReportCommentType[];
}

export interface ReportCommentType {
  id: string;
  reportId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name?: string;
    username?: string;
  };
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
  comments?: string; // @deprecated Will be stored in ReportComment model
  initialComment?: string; // New field for initial comment to be stored in ReportComment
  reportType: ReportType;
  planReportId?: string | null;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
