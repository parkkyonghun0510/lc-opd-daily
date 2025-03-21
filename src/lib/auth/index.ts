import { authOptions } from "./options";
import { UserRole } from "./roles";

export interface SessionUser {
  id: string;
  name?: string;
  email?: string;
  role: UserRole;
  branchId?: string | null;
  assignedBranchIds?: string[];
}

export { authOptions }; 