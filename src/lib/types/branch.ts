/**
 * Represents a branch in the organizational hierarchy
 */
export interface Branch {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  level?: number;
  path?: string[];
}

/**
 * Represents a branch in the hierarchy with level and path information
 */
export interface BranchHierarchy {
  id: string;
  name: string;
  parentId?: string | null;
  level: number;
  path: string[];
}

/**
 * Represents a user's branch assignment
 */
export interface BranchAssignment {
  id: string;
  userId: string;
  branchId: string;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  branch?: Branch;
}

/**
 * Type for a flattened branch tree item
 * Used for UI rendering with indentation
 */
export interface FlattenedBranchTreeItem {
  id: string;
  code: string;
  name: string;
  indent: number;
  hasChildren: boolean;
  level: number;
  isActive: boolean;
}

/**
 * User roles in the system
 */
export type UserRole =
  | "admin"
  | "manager"
  | "supervisor"
  | "operator"
  | "viewer";

/**
 * Permissions for branch access
 */
export enum BranchAccessPermission {
  NONE = "none",
  VIEW = "view",
  SUBMIT = "submit",
  APPROVE = "approve",
  MANAGE = "manage",
  ADMIN = "admin",
}

/**
 * Result of a branch access check
 */
export interface BranchAccessResult {
  hasAccess: boolean;
  permission: BranchAccessPermission;
  reason?: string;
}
