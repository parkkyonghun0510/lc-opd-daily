"use client";

import { useMemo, useEffect, useState } from "react";
import { Bell, LogOut, Settings, User, Loader2, Sun, Moon } from "lucide-react";
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
import { useTheme } from "next-themes";
import { NotificationBell } from '@/components/notifications/NotificationBell';

export function TopBar() {
  const router = useRouter();
  const { userData, isLoading, setIsLoading } = useUserData();
  const userInitials = useUserInitials();
  const permissions = useUserPermissions();
  const { theme, setTheme } = useTheme();
  const [avatarError, setAvatarError] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await signOut({ 
        redirect: true,
        callbackUrl: '/login'
      });
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout. Please try again.");
      setIsLoading(false);
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

  // Reset avatar error state if image URL changes
  useEffect(() => {
    setAvatarError(false);
  }, [profileData.image]);

  // Toggle theme handler
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="h-16 px-4 border-b bg-white dark:bg-gray-800 flex items-center justify-between">
      <div className="flex-1 flex items-center gap-2 md:gap-6">
        <CommandPalette />
        <Greeting />
      </div>

      <div className="flex items-center space-x-4">
        {/* Theme Toggle Button */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun size={18} className="text-gray-600 dark:text-gray-400" />
          ) : (
            <Moon size={18} className="text-gray-600 dark:text-gray-400" />
          )}
        </Button>

        {isLoading ? (
          <div className="flex items-center space-x-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 hidden md:block">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ) : (
          <>
            {permissions?.canViewDashboard && (
              <NotificationBell />
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-1.5">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={avatarError ? `/api/placeholder/avatar?seed=${encodeURIComponent(profileData.displayName)}` : profileData.image}
                        alt={profileData.displayName}
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          // If image fails to load, set error state to true and hide the image
                          setAvatarError(true);
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          console.log("Image failed to load:", profileData.image);
                        }}
                      />
                      <AvatarFallback>
                        {userInitials}
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
