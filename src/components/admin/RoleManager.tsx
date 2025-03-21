import { useState, useEffect } from "react";
import { Permission, UserRole, ROLE_PERMISSIONS } from "@/lib/auth/roles";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { toast } from "sonner";
import { ErrorBoundary } from "react-error-boundary";
import { fetchUsers, fetchBranches, assignUserRole } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branchId: string | null;
  branch?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
}

interface RoleOption {
  id: string;
  name: string;
  displayName: string;
}

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="p-4 text-red-500">
      <p>Something went wrong:</p>
      <pre className="mt-2">{error.message}</pre>
      <button
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
        onClick={resetErrorBoundary}
      >
        Try again
      </button>
    </div>
  );
}

interface RoleManagerProps {
  context?: 'branch' | 'user';
}

export function RoleManager({ context = 'user' }: RoleManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);

  useEffect(() => {
    loadUsers();
    loadBranches();
    loadRoles();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await fetchUsers();
      setUsers(data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error(error instanceof Error ? error.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }

  async function loadBranches() {
    try {
      const data = await fetchBranches();
      setBranches(data);
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error(error instanceof Error ? error.message : "Failed to fetch branches");
    }
  }

  async function loadRoles() {
    try {
      const response = await fetch("/api/admin/roles");
      if (!response.ok) {
        throw new Error("Failed to load roles");
      }
      const data = await response.json();
      setAvailableRoles(data.roles);
    } catch (error) {
      console.error("Error loading roles:", error);
      toast.error("Failed to load roles");
    }
  }

  // Reset form when role changes to clear branch selection if not needed
  useEffect(() => {
    const isAdminRole = selectedRole === UserRole.ADMIN || availableRoles.find(r => r.id === selectedRole)?.name === UserRole.ADMIN;
    if (isAdminRole) {
      // Admin doesn't need branch assignment
      setSelectedBranch(null);
    }
  }, [selectedRole, availableRoles]);

  async function handleRoleAssignment() {
    if (!selectedUser || !selectedRole) {
      toast.error("Please select a user and role");
      return;
    }

    setSubmitting(true);

    try {
      // If the role is admin, no branch is needed
      // If the role requires a branch but none is selected, show an error
      const isAdminRole = selectedRole === UserRole.ADMIN || availableRoles.find(r => r.id === selectedRole)?.name === UserRole.ADMIN;
      
      if (!isAdminRole && !selectedBranch) {
        toast.error("Please select a branch for this role");
        setSubmitting(false);
        return;
      }

      // Find the role name to pass to the API
      const selectedRoleName = availableRoles.find(r => r.id === selectedRole)?.name || selectedRole;

      await assignUserRole(
        selectedUser,
        selectedRoleName,
        isAdminRole ? null : selectedBranch
      );

      toast.success("Role assigned successfully");
      await loadUsers(); // Refresh user list
      
      // Reset form
      setSelectedUser(null);
      setSelectedRole("");
      setSelectedBranch(null);
    } catch (error) {
      console.error("Error assigning role:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to assign role"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Filter users based on search query
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    return context === 'branch' 
      ? matchesSearch && user.role !== UserRole.ADMIN
      : matchesSearch;
  });

  // Get current user info
  const selectedUserData = selectedUser ? users.find(u => u.id === selectedUser) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        setSelectedUser(null);
        setSelectedRole("");
        setSelectedBranch(null);
        loadUsers();
        loadBranches();
      }}
    >
      <PermissionGate
        permissions={[Permission.ASSIGN_ROLES]}
        fallback={
          <div className="p-6 text-red-500">
            You don&apos;t have permission to manage roles
          </div>
        }
      >
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Role Management</h2>
            <button
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={() => {
                loadUsers();
                loadBranches();
              }}
            >
              Refresh
            </button>
          </div>

          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Input
                type="search"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            {/* User Selection */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium">
                  Select User
                </label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Select a user to manage their role and permissions</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <ScrollArea className="h-[200px] border rounded-md">
                <div className="p-2">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      className={`w-full text-left p-2 rounded-md mb-1 ${
                        selectedUser === user.id
                          ? "bg-blue-100 dark:bg-blue-900"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                      onClick={() => setSelectedUser(user.id)}
                    >
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.email} - {user.role}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Current User Settings */}
            {selectedUserData && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                <p className="text-sm font-medium">Current settings:</p>
                <p className="text-sm">Role: <span className="font-semibold">{selectedUserData.role}</span></p>
                <p className="text-sm">Branch: <span className="font-semibold">{selectedUserData.branch?.name || "None"}</span></p>
              </div>
            )}

            {/* Role Selection */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium">
                  Select New Role
                </label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Choose a new role for the selected user</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <select
                className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="">Select a role...</option>
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch Selection */}
            {selectedRole && !(selectedRole === UserRole.ADMIN || availableRoles.find(r => r.id === selectedRole)?.name === UserRole.ADMIN) && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium">
                    Select Branch
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select a branch for the user to manage</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <select
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                  value={selectedBranch || ""}
                  onChange={(e) => setSelectedBranch(e.target.value || null)}
                  required
                >
                  <option value="">Select a branch...</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {availableRoles.find(r => r.id === selectedRole)?.name === 'BRANCH_MANAGER' 
                    ? "Branch managers can access their assigned branch and all sub-branches" 
                    : "Users can only access explicitly assigned branches"}
                </p>
              </div>
            )}

            {/* Role Permissions Display */}
            {selectedRole && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-medium">Role Permissions</h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Permissions associated with the selected role</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(Permission)
                    .filter((permission) =>
                      ROLE_PERMISSIONS[selectedRole as UserRole]?.includes(
                        permission
                      )
                    )
                    .map((permission) => (
                      <div
                        key={permission}
                        className="p-2 bg-gray-100 dark:bg-gray-800 rounded"
                      >
                        {permission.replace(/_/g, " ")}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleRoleAssignment}
              disabled={!selectedUser || !selectedRole || submitting}
            >
              {submitting ? "Assigning..." : "Assign Role"}
            </button>
          </div>
        </div>
      </PermissionGate>
    </ErrorBoundary>
  );
}
