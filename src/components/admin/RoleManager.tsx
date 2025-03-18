import { useState, useEffect } from "react";
import { Permission, UserRole, ROLE_PERMISSIONS } from "@/lib/auth/roles";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { toast } from "sonner";
import { ErrorBoundary } from "react-error-boundary";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string | null;
}

interface Branch {
  id: string;
  name: string;
  parentId: string | null;
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
  const [selectedRole, setSelectedRole] = useState<UserRole | "">("");
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid users data format");
      }
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
      throw error;
    } finally {
      setLoading(false);
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
      throw error;
    }
  }

  async function handleRoleAssignment() {
    if (!selectedUser || !selectedRole) {
      toast.error("Please select a user and role");
      return;
    }

    try {
      const response = await fetch("/api/roles/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser,
          role: selectedRole,
          branchId: selectedBranch,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to assign role");
      }

      toast.success("Role assigned successfully");
      await fetchUsers(); // Refresh user list
      setSelectedUser(null);
      setSelectedRole("");
      setSelectedBranch(null);
    } catch (error) {
      console.error("Error assigning role:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to assign role"
      );
    }
  }

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
        fetchUsers();
        fetchBranches();
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
                fetchUsers();
                fetchBranches();
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

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Role
              </label>
              <select
                className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              >
                <option value="">Select a role...</option>
                {Object.values(UserRole).map((role) => (
                  <option key={role} value={role}>
                    {role.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch Selection */}
            {selectedRole && selectedRole !== UserRole.ADMIN && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Branch
                </label>
                <select
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                  value={selectedBranch || ""}
                  onChange={(e) => setSelectedBranch(e.target.value || null)}
                >
                  <option value="">Select a branch...</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Role Permissions Display */}
            {selectedRole && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Role Permissions</h3>
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
              disabled={!selectedUser || !selectedRole}
            >
              Assign Role
            </button>
          </div>
        </div>
      </PermissionGate>
    </ErrorBoundary>
  );
}
