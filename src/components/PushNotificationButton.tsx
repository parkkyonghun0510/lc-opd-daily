import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { requestNotificationPermission } from '@/utils/pushNotifications';
import { registerServiceWorker } from '@/utils/serviceWorker';

export function PushNotificationButton() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    const checkSupport = async () => {
      if ('Notification' in window && 'serviceWorker' in navigator) {
        setIsSupported(true);
        try {
          await registerServiceWorker();
          // Clean up expired subscriptions
          await fetch('/api/push/cleanup', { method: 'POST' });
        } catch (error) {
          console.error('Failed to register service worker:', error);
        }
      }
    };
    checkSupport();
  }, []);

  const handleSubscribe = async () => {
    try {
      setIsLoading(true);
      const subscription = await requestNotificationPermission();
      if (subscription) {
        setIsSubscribed(true);
        // Clean up expired subscriptions after successful subscription
        await fetch('/api/push/cleanup', { method: 'POST' });
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return null; // Don't show the button if push notifications are not supported
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSubscribe}
      disabled={isLoading || isSubscribed}
      className="gap-2"
    >
      <Bell className="h-4 w-4" />
      {isSubscribed ? 'Notifications Enabled' : 'Enable Notifications'}
    </Button>
  );
} 