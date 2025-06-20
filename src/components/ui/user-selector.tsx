"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Search, User } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface UserData {
  id: string;
  name: string;
  username: string;
  role?: string;
}

interface UserSelectorProps {
  value?: string;
  onChange?: (userId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  filterByRole?: string; // Optional role filter
}

export function UserSelector({
  value,
  onChange,
  placeholder = "Select user",
  className = "",
  disabled = false,
  id,
  filterByRole,
}: UserSelectorProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;

    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query),
    );
  }, [users, searchQuery]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        // Build the URL with optional role filter
        let url = "/api/users";
        if (filterByRole) {
          url += `?role=${filterByRole}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch users");
        const data = await response.json();

        // Sort users by name for easier selection
        const sortedUsers = (data.users || []).sort(
          (a: UserData, b: UserData) => a.name.localeCompare(b.name),
        );

        setUsers(sortedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
        toast({
          title: "Error",
          description: "Failed to load users",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [filterByRole]);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading users...</span>
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || loading || users.length === 0}
    >
      <SelectTrigger className={className} id={id}>
        <User className="h-4 w-4 mr-2" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <div className="flex items-center px-2 pb-2">
          <Search className="h-4 w-4 mr-2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name} ({user.username})
              {user.role && (
                <span className="ml-1 text-muted-foreground text-xs">
                  ({user.role})
                </span>
              )}
            </SelectItem>
          ))
        ) : (
          <SelectItem value="no-results" disabled>
            {searchQuery ? "No matching users found" : "No users available"}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
