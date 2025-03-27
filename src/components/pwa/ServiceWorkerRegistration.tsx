'use client';

import { useEffect, useState } from 'react';
import { requestNotificationPermission, checkSubscription } from '@/utils/pushNotifications';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

export function ServiceWorkerRegistration() {
  const [serviceWorkerRegistered, setServiceWorkerRegistered] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const registerServiceWorker = async () => {
      try {
        if ('serviceWorker' in navigator) {
          // Try to register the service worker
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Service Worker registered:', registration);
          setServiceWorkerRegistered(true);
          
          // Check if already subscribed, only request permissions when not already subscribed
          const isSubscribed = await checkSubscription();
          if (!isSubscribed && 'Notification' in window && Notification.permission === 'default') {
            // Notification permission not decided yet, show a toast
            toast({
              title: 'Enable Notifications',
              description: 'Would you like to receive notifications for important updates?',
              action: (
                <Button onClick={() => requestNotificationPermission()}>
                  Enable
                </Button>
              ),
            });
          }
        }
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        toast({
          title: 'Notification Setup Failed',
          description: 'We couldn\'t set up notifications. Some features may not work correctly.',
          variant: 'destructive',
        });
      }
    };

    registerServiceWorker();
  }, [toast]);

  return null;
} 