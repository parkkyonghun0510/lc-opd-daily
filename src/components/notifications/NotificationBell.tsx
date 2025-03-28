'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NotificationList } from './NotificationList';
import { useNotifications } from '@/contexts/NotificationContext';
import { ScrollArea } from '@/components/ui/scroll-area';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const { unreadCount, notifications, markAllAsRead, loading, fetchNotifications } = useNotifications();
  const router = useRouter();

  // Debounced fetch handler to prevent multiple API calls
  const debouncedFetch = useCallback(() => {
    if (!hasLoaded) {
      // Only fetch if we haven't loaded before
      // Use a combined approach - fetch all notifications at once with unread first
      fetchNotifications(15, 0, false);
      setHasLoaded(true);
    }
  }, [fetchNotifications, hasLoaded]);

  // Fetch notifications when dropdown is opened
  useEffect(() => {
    if (open) {
      debouncedFetch();
    } else {
      // Reset hasLoaded state when popover closes to ensure fresh data next open
      // But only after some time to prevent refetching on quick open/close
      const timer = setTimeout(() => {
        setHasLoaded(false);
      }, 60000); // Reset after 1 minute of being closed
      
      return () => clearTimeout(timer);
    }
  }, [open, debouncedFetch]);

  const handleViewAll = () => {
    router.push('/dashboard/notifications');
    setOpen(false);
  };

  const handleClearAll = async () => {
    await markAllAsRead();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell size={18} className="text-gray-600 dark:text-gray-400" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs min-w-4 h-4 flex items-center justify-center"
              variant="destructive"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end" sideOffset={4}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearAll}>
              Mark all as read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Bell size={40} className="text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {loading ? 'Loading notifications...' : 'No notifications yet'}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {!loading && 'You\'ll see notifications here when you receive them'}
              </p>
            </div>
          ) : (
            <NotificationList 
              notifications={notifications} 
              onClose={() => setOpen(false)} 
            />
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handleViewAll}
            >
              View all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
} 