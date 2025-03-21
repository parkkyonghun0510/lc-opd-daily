import { useState, useEffect } from "react";
import { Permission, UserRole } from "@/lib/auth/roles";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { toast } from "sonner";
import { ErrorBoundary } from "react-error-boundary";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branchId: string | null;
}

interface Branch {
  id: string;
  code: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  branchId: string | null;
  isDefault: boolean;
  role: Role;
  branch: Branch | null;
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

interface UserRoleManagerProps {
  userId?: string;
}

export function UserRoleManager({ userId: initialUserId }: UserRoleManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(initialUserId || null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchBranches();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchUserRoles(selectedUser);
    } else {
      setUserRoles([]);
    }
  }, [selectedUser]);

  async function fetchUsers() {
    try {
      const response = await fetch("/api/users", {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
      });
      
      if (response.redirected) {
        // User was redirected, likely to login page
        toast.error("Authentication required. Please log in.");
        window.location.href = response.url; // Redirect to login page
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format. Expected JSON.");
      }
      
      const data = await response.json();
      if (!data.users || !Array.isArray(data.users)) {
        throw new Error("Invalid users data format");
      }
      setUsers(data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }

  async function fetchRoles() {
    try {
      const response = await fetch("/api/roles");
      if (!response.ok) {
        throw new Error("Failed to fetch roles");
      }
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast.error("Failed to fetch roles");
    }
  }

  async function fetchBranches() {
    try {
      const response = await fetch("/api/branches");
      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }
      const data = await response.json();
      setBranches(data);
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("Failed to fetch branches");
    }
  }

  async function fetchUserRoles(userId: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/roles/manage?userId=${userId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch user roles");
      }
      const data = await response.json();
      setUserRoles(data);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      toast.error("Failed to fetch user roles");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleAssignment() {
    if (!selectedUser || !selectedRole) {
      toast.error("Please select a user and role");
      return;
    }

    try {
      const response = await fetch("/api/roles/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser,
          roleId: selectedRole,
          branchId: selectedBranch,
          isDefault,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to assign role");
      }

      toast.success("Role assigned successfully");
      fetchUserRoles(selectedUser);
      resetForm();
    } catch (error) {
      console.error("Error assigning role:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to assign role"
      );
    }
  }

  async function handleRoleRemoval(userRoleId: string) {
    try {
      const response = await fetch(`/api/roles/manage?id=${userRoleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove role");
      }

      toast.success("Role removed successfully");
      if (selectedUser) {
        fetchUserRoles(selectedUser);
      }
    } catch (error) {
      console.error("Error removing role:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove role"
      );
    }
  }

  function resetForm() {
    setSelectedRole("");
    setSelectedBranch(null);
    setIsDefault(false);
  }

  if (loading && !userRoles.length) {
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
        resetForm();
        if (selectedUser) {
          fetchUserRoles(selectedUser);
        }
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
                if (selectedUser) {
                  fetchUserRoles(selectedUser);
                }
              }}
            >
              Refresh
            </button>
          </div>

          <div className="space-y-4">
            {/* User Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Select User
              </label>
              <select
                className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                value={selectedUser || ""}
                onChange={(e) => setSelectedUser(e.target.value || null)}
              >
                <option value="">Select a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            {selectedUser && (
              <>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
                  <h3 className="text-lg font-medium mb-3">Assign New Role</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Role Selection */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Select Role
                      </label>
                      <select
                        className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                      >
                        <option value="">Select a role...</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Branch Selection */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Select Branch (Optional)
                      </label>
                      <select
                        className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                        value={selectedBranch || ""}
                        onChange={(e) => setSelectedBranch(e.target.value || null)}
                      >
                        <option value="">Global (All Branches)</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name} ({branch.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Default Role Checkbox */}
                  <div className="mt-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                      />
                      <span className="text-sm">Set as default role</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      The default role will be used for backward compatibility with existing features.
                    </p>
                  </div>

                  <div className="mt-4">
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      onClick={handleRoleAssignment}
                      disabled={!selectedRole}
                    >
                      Assign Role
                    </button>
                  </div>
                </div>

                {/* Current Roles */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Current Roles</h3>
                  {userRoles.length === 0 ? (
                    <p className="text-gray-500">No roles assigned yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Role
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Branch
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Default
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                          {userRoles.map((userRole) => (
                            <tr key={userRole.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {userRole.role.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {userRole.branch
                                  ? `${userRole.branch.name} (${userRole.branch.code})`
                                  : "Global (All Branches)"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {userRole.isDefault ? (
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    Default
                                  </span>
                                ) : (
                                  "No"
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  className="text-red-600 hover:text-red-900"
                                  onClick={() => handleRoleRemoval(userRole.id)}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </PermissionGate>
    </ErrorBoundary>
  );
}