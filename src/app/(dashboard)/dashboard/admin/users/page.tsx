"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Edit, Trash, Plus, Check, X } from "lucide-react";
import { fetchUsers, fetchBranches } from "@/lib/api";
import { UserRole } from "@/lib/auth/roles";

type Branch = {
  id: string;
  code: string;
  name: string;
};

type Role = UserRole;

const ROLES: Role[] = Object.values(UserRole);

type User = {
  id: string;
  username: string;
  email: string;
  name: string;
  role: Role;
  branchId: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  branch: Branch | null;
};

type Meta = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

// Custom badge variants
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface BadgeVariants {
  [key: string]: string;
}

export default function UsersPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter();

  // State for user list and pagination
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 10,
    pages: 1, // Initialize pages to 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  // State for branches (for dropdowns)
  const [branches, setBranches] = useState<Branch[]>([]);

  // State for dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // State for form inputs
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
    role: "user" as Role,
    branchId: "none",
    isActive: true,
  });

  // State for operation status
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch users based on filters and pagination
  const fetchUsersWithParams = async (page = 1) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      queryParams.append("limit", meta.limit.toString());

      if (search) queryParams.append("search", search);
      if (roleFilter !== "all") queryParams.append("role", roleFilter);
      if (branchFilter !== "all") queryParams.append("branch", branchFilter);
      if (activeFilter !== "all")
        queryParams.append(
          "active",
          activeFilter === "active" ? "true" : "false",
        );

      const data = await fetchUsers(`?${queryParams.toString()}`);
      setUsers(data.users);
      setMeta({
        total: data.total,
        page: data.page,
        limit: data.limit,
        pages: data.pages || 1, // Default to 1 if pages is not provided
      });
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch branches for dropdown
  const loadBranches = async () => {
    try {
      const data = await fetchBranches();
      setBranches(data);
    } catch (err) {
      console.error("Error fetching branches:", err);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchUsersWithParams();
    loadBranches();
  }, []);

  // Handle filter changes
  useEffect(() => {
    fetchUsersWithParams(1); // Reset to first page on filter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, branchFilter, activeFilter]);

  // Handle page change
  const handlePageChange = (page: number) => {
    fetchUsersWithParams(page);
  };

  // Handle role change
  const handleRoleChange = async (
    userId: string,
    newRole: string,
    branchId: string | null,
  ) => {
    try {
      const response = await fetch("/api/roles/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, role: newRole, branchId }),
      });

      if (!response.ok) {
        throw new Error("Failed to update role");
      }

      // Refresh user list and reset editing state
      fetchUsersWithParams();
      setEditingRole(null);
      setSelectedUser(null);
    } catch (err) {
      console.error("Error updating role:", err);
      alert(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  // Handle checkbox changes
  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData({ ...formData, [name]: checked });
  };

  // Reset form data
  const resetFormData = () => {
    setFormData({
      username: "",
      email: "",
      name: "",
      password: "",
      role: "user" as Role,
      branchId: "none",
      isActive: true,
    });
  };

  // Open create dialog
  const openCreateDialog = () => {
    resetFormData();
    setFormError(null);
    setCreateDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      name: user.name,
      password: "", // Don't prefill password
      role: user.role,
      branchId: user.branchId || "none",
      isActive: user.isActive,
    });
    setFormError(null);
    setEditDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  // Create user
  const createUser = async () => {
    setFormSubmitting(true);
    setFormError(null);

    // Prepare data for API - convert "none" to null for branchId
    const submitData = {
      ...formData,
      branchId: formData.branchId === "none" ? null : formData.branchId,
    };

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      // Refresh user list
      fetchUsersWithParams();
      setCreateDialogOpen(false);
      resetFormData();
    } catch (err) {
      console.error("Error creating user:", err);
      setFormError(
        err instanceof Error ? err.message : "Failed to create user",
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // Update user
  const updateUser = async () => {
    if (!selectedUser) return;

    setFormSubmitting(true);
    setFormError(null);

    // Only include password if it was provided
    const updateData = {
      ...formData,
      branchId: formData.branchId === "none" ? null : formData.branchId,
    };

    if (!updateData.password) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...dataWithoutPassword } = updateData;

      try {
        const response = await fetch(`/api/users/${selectedUser.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataWithoutPassword),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update user");
        }

        // Refresh user list
        fetchUsersWithParams();
        setEditDialogOpen(false);
        resetFormData();
      } catch (err) {
        console.error("Error updating user:", err);
        setFormError(
          err instanceof Error ? err.message : "Failed to update user",
        );
      } finally {
        setFormSubmitting(false);
      }
    } else {
      try {
        const response = await fetch(`/api/users/${selectedUser.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update user");
        }

        // Refresh user list
        fetchUsersWithParams();
        setEditDialogOpen(false);
        resetFormData();
      } catch (err) {
        console.error("Error updating user:", err);
        setFormError(
          err instanceof Error ? err.message : "Failed to update user",
        );
      } finally {
        setFormSubmitting(false);
      }
    }
  };

  // Delete user
  const deleteUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete user");
      }

      // Refresh user list
      fetchUsersWithParams();
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error("Error deleting user:", err);
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">User Management</h1>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" /> Add New User
        </Button>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Manage system users and their permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search users..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={branchFilter}
              onValueChange={(value) => setBranchFilter(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={activeFilter}
              onValueChange={(value) => setActiveFilter(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Loading indicator */}
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* User table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.name}
                          </TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {editingRole === user.id ? (
                              <div className="flex items-center gap-2">
                                <Select
                                  value={selectedUser?.role || user.role}
                                  onValueChange={(value) => {
                                    setSelectedUser({
                                      ...user,
                                      role: value as Role,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ROLES.map((role) => (
                                      <SelectItem key={role} value={role}>
                                        {role.charAt(0).toUpperCase() +
                                          role.slice(1)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (selectedUser) {
                                      handleRoleChange(
                                        user.id,
                                        selectedUser.role,
                                        selectedUser.branchId,
                                      );
                                    }
                                  }}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditingRole(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    user.role === UserRole.ADMIN
                                      ? "destructive"
                                      : "default"
                                  }
                                >
                                  {user.role.replace("_", " ")}
                                </Badge>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setEditingRole(user.id);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.branch
                              ? `${user.branch.code} - ${user.branch.name}`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {user.isActive ? (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-800 border-green-200"
                              >
                                <Check className="mr-1 h-3 w-3" /> Active
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="bg-red-100 text-red-800 border-red-200"
                              >
                                <X className="mr-1 h-3 w-3" /> Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(user)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {meta.pages > 1 && (
                <div className="flex justify-center mt-4">
                  <Pagination
                    currentPage={meta.page}
                    totalPages={meta.pages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. All fields are required.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-md text-sm">
              {formError}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                placeholder="johndoe"
                className="col-span-3"
                value={formData.username}
                onChange={handleInputChange}
                disabled={formSubmitting}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Full Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="John Doe"
                className="col-span-3"
                value={formData.name}
                onChange={handleInputChange}
                disabled={formSubmitting}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                className="col-span-3"
                value={formData.email}
                onChange={handleInputChange}
                disabled={formSubmitting}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                className="col-span-3"
                value={formData.password}
                onChange={handleInputChange}
                disabled={formSubmitting}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleSelectChange("role", value)}
                disabled={formSubmitting}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="branch" className="text-right">
                Branch
              </Label>
              <Select
                value={formData.branchId}
                onValueChange={(value) => handleSelectChange("branchId", value)}
                disabled={formSubmitting}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Branch</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="isActive" className="text-right">
                Active
              </Label>
              <div className="flex items-center space-x-2 col-span-3">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange("isActive", checked === true)
                  }
                  disabled={formSubmitting}
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  User account is active
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={createUser} disabled={formSubmitting}>
              {formSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                "Create User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information. Leave password blank to keep it
              unchanged.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-md text-sm">
              {formError}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                placeholder="johndoe"
                className="col-span-3"
                value={formData.username}
                onChange={handleInputChange}
                disabled={formSubmitting}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Full Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="John Doe"
                className="col-span-3"
                value={formData.name}
                onChange={handleInputChange}
                disabled={formSubmitting}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                className="col-span-3"
                value={formData.email}
                onChange={handleInputChange}
                disabled={formSubmitting}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Leave blank to keep unchanged"
                className="col-span-3"
                value={formData.password}
                onChange={handleInputChange}
                disabled={formSubmitting}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleSelectChange("role", value)}
                disabled={formSubmitting}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="branch" className="text-right">
                Branch
              </Label>
              <Select
                value={formData.branchId}
                onValueChange={(value) => handleSelectChange("branchId", value)}
                disabled={formSubmitting}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Branch</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="isActive" className="text-right">
                Active
              </Label>
              <div className="flex items-center space-x-2 col-span-3">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange("isActive", checked === true)
                  }
                  disabled={formSubmitting}
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  User account is active
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={updateUser} disabled={formSubmitting}>
              {formSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                </>
              ) : (
                "Update User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user &quot;
              {selectedUser?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
