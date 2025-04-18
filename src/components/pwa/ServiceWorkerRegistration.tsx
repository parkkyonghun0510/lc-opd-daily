'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export function ServiceWorkerRegistration() {
  const [serviceWorkerRegistered, setServiceWorkerRegistered] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const registerServiceWorker = async () => {
      try {
        if ('serviceWorker' in navigator) {
          // Try to register the service worker
          const registration = await navigator.serviceWorker.register('/sw.js');
          //console.log('Service Worker registered:', registration);
          setServiceWorkerRegistered(true);
          
          // We no longer show the notification toast here
          // The NotificationPrompt component will handle this
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