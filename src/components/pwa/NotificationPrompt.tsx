'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { TopBanner } from './TopBanner';
import { requestNotificationPermission, checkSubscription } from '@/utils/pushNotifications';

// Key for storing user preference in localStorage
const NOTIFICATION_PROMPT_SEEN_KEY = 'notification_prompt_seen';
const NOTIFICATION_PROMPT_DISMISSED_DATE_KEY = 'notification_prompt_dismissed_date';

export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Only show notification prompt if notifications are supported
    const checkNotificationStatus = async () => {
      // Check if notifications are supported
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
      }

      // Check if permission is already granted or denied
      if (Notification.permission === 'granted' || Notification.permission === 'denied') {
        return;
      }

      // Check if already subscribed
      const subscribed = await checkSubscription();
      setIsSubscribed(subscribed);

      // Check if user has already seen or dismissed the prompt
      try {
        const hasSeenPrompt = localStorage.getItem(NOTIFICATION_PROMPT_SEEN_KEY) === 'true';
        const dismissedDateStr = localStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_DATE_KEY);
        
        // If user has dismissed the prompt recently (within last 7 days), don't show it again
        if (dismissedDateStr) {
          const dismissedDate = new Date(dismissedDateStr);
          const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceDismissed < 7) {
            return;
          }
        }
        
        // If user has not seen the prompt before or it's been a while since they dismissed it
        if (!hasSeenPrompt || (dismissedDateStr && !subscribed)) {
          // Wait longer before showing notification prompt (don't show at the same time as install prompt)
          setTimeout(() => {
            setShowPrompt(true);
            // Mark that user has seen the prompt
            localStorage.setItem(NOTIFICATION_PROMPT_SEEN_KEY, 'true');
          }, 5000);
        }
      } catch (error) {
        // If there's an error with localStorage (e.g., in incognito mode), proceed with default behavior
        console.error('Error accessing localStorage:', error);
        if (!subscribed && Notification.permission === 'default') {
          setTimeout(() => {
            setShowPrompt(true);
          }, 5000);
        }
      }
    };

    checkNotificationStatus();
  }, []);

  const handleSubscribe = async () => {
    try {
      setIsLoading(true);
      const subscription = await requestNotificationPermission();
      
      if (subscription) {
        setIsSubscribed(true);
        setShowPrompt(false);
        // Clear the dismissed date if user subscribes
        localStorage.removeItem(NOTIFICATION_PROMPT_DISMISSED_DATE_KEY);
      }
    } catch (error) {
      console.error('Subscription error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Store the current date when user dismisses the prompt
    localStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_DATE_KEY, new Date().toISOString());
  };

  const actions = (
    <>
      <Button
        variant="outline"
        onClick={handleDismiss}
        className="text-sm"
      >
        Not now
      </Button>
      <Button
        onClick={handleSubscribe}
        disabled={isLoading}
        className="text-sm"
      >
        {isLoading ? 'Processing...' : 'Enable'}
      </Button>
    </>
  );

  return (
    <TopBanner
      title="Enable Notifications"
      description="Would you like to receive notifications for important updates?"
      isVisible={showPrompt}
      onDismiss={handleDismiss}
      actions={actions}
    />
  );
} 