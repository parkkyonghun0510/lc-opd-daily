"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserData {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
}

interface UserDisplayNameProps {
  userId: string;
  showAvatar?: boolean;
  avatarSize?: number;
  className?: string;
  fallback?: string;
}

export function UserDisplayName({ 
  userId, 
  showAvatar = false, 
  avatarSize = 24, 
  className,
  fallback
}: UserDisplayNameProps) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      setError("No user ID provided");
      return;
    }

    async function fetchUserData() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/${userId}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }
        
        const data = await response.json();
        setUserData(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Error loading user data");
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserData();
  }, [userId]);

  // Format user ID for display if we can't get the user data
  const formatUserId = (id: string) => {
    if (id.length <= 8) return id;
    return `${id.substring(0, 4)}...${id.substring(id.length - 4)}`;
  };

  if (isLoading) {
    return <Skeleton className="h-4 w-24" />;
  }

  // If there's an error or no data, show a formatted version of the ID or the fallback
  if (error || !userData) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {showAvatar && (
          <Avatar className={`mr-2 inline-flex h-${avatarSize} w-${avatarSize}`}>
            <AvatarFallback>
              <User size={avatarSize - 8} />
            </AvatarFallback>
          </Avatar>
        )}
        {fallback || formatUserId(userId)}
      </span>
    );
  }

  // Display user's name or username, preferring name if available
  const displayName = userData.name || userData.username || fallback || formatUserId(userId);
  
  return (
    <span className={className}>
      {showAvatar && (
        <Avatar className={`mr-2 inline-flex h-${avatarSize} w-${avatarSize}`}>
          <AvatarFallback>
            {(userData.name?.charAt(0) || userData.username?.charAt(0) || "U").toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      {displayName}
    </span>
  );
} 