"use client";

import { useMemo } from "react";
import { Bell, LogOut, Settings, User, Loader2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useUserData,
  useUserInitials,
  useUserPermissions,
} from "@/contexts/UserDataContext";
import { CommandPalette } from "../search/CommandPalette";
import { Greeting } from "../greeting/Greeting";

export function TopBar() {
  const router = useRouter();
  const { userData, isLoading } = useUserData();
  const userInitials = useUserInitials();
  const permissions = useUserPermissions();

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
      toast.success("Logged out successfully");
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout. Please try again.");
    }
  };

  // Memoize profile data to reduce unnecessary re-calculations
  const profileData = useMemo(
    () => ({
      displayName: userData?.computedFields?.displayName || "User",
      accessLevel: userData?.computedFields?.accessLevel || "Guest",
      primaryBranch: userData?.computedFields?.primaryBranch,
      image: userData?.image || "",
    }),
    [userData?.computedFields, userData?.image]
  );

  return (
    <div className="h-16 px-4 border-b bg-white dark:bg-gray-800 flex items-center justify-between">
      <div className="flex-1 flex items-center gap-2 md:gap-6">
        <CommandPalette />
        <Greeting />
      </div>

      <div className="flex items-center space-x-4">
        {isLoading ? (
          <>
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-32" />
          </>
        ) : (
          <>
            {permissions?.canViewAuditLogs && (
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => router.push("/dashboard/notifications")}
              >
                <Bell size={18} className="text-gray-600 dark:text-gray-400" />
                {permissions?.canAccessAdmin && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-1.5">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={profileData.image}
                        alt={profileData.displayName}
                      />
                      <AvatarFallback>
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          userInitials
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {profileData.displayName}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {profileData.accessLevel}
                        </p>
                        {profileData.primaryBranch && (
                          <Badge variant="outline" className="text-xs">
                            {profileData.primaryBranch.code}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard/profile")}
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                {permissions?.canManageSettings && (
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/settings")}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 dark:text-red-400"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
