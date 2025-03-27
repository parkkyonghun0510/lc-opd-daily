'use client';

import { Button } from '@/components/ui/button';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationList } from '@/components/notifications/NotificationList';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function NotificationsPage() {
  const { 
    notifications, 
    loading, 
    unreadCount, 
    fetchNotifications, 
    markAllAsRead, 
    error 
  } = useNotifications();
  
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  useEffect(() => {
    // Reset page when component mounts
    setPage(1);
    fetchNotifications(LIMIT, 0);
  }, [fetchNotifications]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      await fetchNotifications(LIMIT, page * LIMIT);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = notifications.length >= page * LIMIT;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            onClick={() => markAllAsRead()}
            disabled={loading}
          >
            Mark all as read
          </Button>
        )}
      </div>
      
      {loading && page === 1 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-card border rounded-lg p-6 text-center">
          <h3 className="text-lg font-medium mb-2">No notifications yet</h3>
          <p className="text-muted-foreground">
            When you receive notifications, they will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <NotificationList notifications={notifications} />
          
          {hasMore && (
            <div className="p-4 bg-muted/20 border-t">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="bg-destructive/10 border-destructive/20 border rounded-lg p-4 text-destructive">
          <h3 className="font-medium">Error loading notifications</h3>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
} 