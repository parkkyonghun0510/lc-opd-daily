"use client";

import { useStore } from '@/auth/store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Settings, Shield, Bell, Moon, Sun, Laptop, Clock, History } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useTheme } from 'next-themes';
import { refreshSession } from '@/auth/store/actions';
import { formatDistanceToNow } from 'date-fns';

/**
 * AuthStatusIndicator component
 * 
 * Shows the current authentication status and provides quick access to user-related actions.
 * Uses the advanced Zustand store for state management.
 */
export function AuthStatusIndicator() {
  const { user, isAuthenticated, logout, profile, timeUntilExpiry } = useStore();
  const { theme, setTheme } = useTheme();

  // If not authenticated, show login button
  if (!isAuthenticated || !user) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">
          <User className="h-4 w-4 mr-2" />
          Login
        </Link>
      </Button>
    );
  }

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    const name = profile?.name || user.name || '';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase() || 'U';
  };

  // Format role for display
  const formatRole = (role: string) => {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Format session expiry time
  const formatSessionExpiry = () => {
    const timeLeft = timeUntilExpiry();
    if (timeLeft <= 0) return 'Expired';
    
    return formatDistanceToNow(Date.now() + timeLeft, { addSuffix: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.image || user.image} alt={profile?.name || user.name} />
            <AvatarFallback>{getUserInitials()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{profile?.name || user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{profile?.email || user.email}</p>
            <div className="flex items-center pt-1">
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                {formatRole(profile?.role || user.role)}
              </Badge>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun className="h-4 w-4 mr-2 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 mr-2 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="ml-2">Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="h-4 w-4 mr-2" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Laptop className="h-4 w-4 mr-2" />
                System
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        
        <DropdownMenuItem onClick={() => refreshSession()}>
          <Clock className="h-4 w-4 mr-2" />
          <span>Session expires {formatSessionExpiry()}</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link href="/dashboard/activity">
            <History className="h-4 w-4 mr-2" />
            Activity Log
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => logout()}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
