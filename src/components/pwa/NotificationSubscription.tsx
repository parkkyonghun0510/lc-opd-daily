'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { requestNotificationPermission, unsubscribeFromPushNotifications, checkSubscription } from '@/utils/pushNotifications';

export function NotificationSubscription() {
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if notifications are supported
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsSupported(false);
      return;
    }

    // Check if notifications are denied
    if ('Notification' in window && Notification.permission === 'denied') {
      setPermissionDenied(true);
    }

    // Check subscription status on mount
    const checkInitialSubscription = async () => {
      try {
        const subscribed = await checkSubscription();
        setIsSubscribed(subscribed);
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };

    checkInitialSubscription();
  }, []);

  const handleSubscribe = async () => {
    try {
      setIsLoading(true);
      const subscription = await requestNotificationPermission();
      
      if (subscription) {
        setIsSubscribed(true);
        setPermissionDenied(false);
        toast({
          title: 'Subscribed',
          description: 'You are now subscribed to push notifications',
        });
      } else {
        // Check if permission was denied
        if ('Notification' in window && Notification.permission === 'denied') {
          setPermissionDenied(true);
        }
        
        toast({
          title: 'Subscription Failed',
          description: 'Could not subscribe to push notifications. Please check your browser settings.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Subscription error:', error);
      toast({
        title: 'Error',
        description: 'Failed to subscribe to push notifications',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      setIsLoading(true);
      const result = await unsubscribeFromPushNotifications();
      
      if (result) {
        setIsSubscribed(false);
        toast({
          title: 'Unsubscribed',
          description: 'You are now unsubscribed from push notifications',
        });
      }
    } catch (error) {
      console.error('Unsubscription error:', error);
      toast({
        title: 'Error',
        description: 'Failed to unsubscribe from push notifications',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-md text-yellow-800">
        Push notifications are not supported in your browser.
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-md space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-lg">Notification Settings</h3>
          <p className="text-sm text-muted-foreground">
            {isSubscribed 
              ? 'You are currently receiving push notifications' 
              : 'Subscribe to receive push notifications'}
          </p>
        </div>
        <div>
          {isSubscribed === null ? (
            <Button disabled>Checking...</Button>
          ) : isSubscribed ? (
            <Button 
              variant="outline" 
              onClick={handleUnsubscribe}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Unsubscribe'}
            </Button>
          ) : (
            <Button 
              onClick={handleSubscribe}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Subscribe'}
            </Button>
          )}
        </div>
      </div>
      {permissionDenied && (
        <div className="text-sm p-2 bg-red-50 border border-red-200 rounded text-red-600">
          Notifications are blocked. Please update your browser settings to allow notifications for this site.
        </div>
      )}
    </div>
  );
} 