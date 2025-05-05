'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { TopBanner } from './TopBanner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Key for storing user preference in localStorage
const INSTALL_PROMPT_DISMISSED_DATE_KEY = 'install_prompt_dismissed_date';

// Function to track analytics events
const trackAnalyticsEvent = (event: string, data?: Record<string, any>) => {
  try {
    // Replace with your analytics tracking logic
    console.log('Analytics Event:', event, data);
  } catch (error) {
    console.error('Error tracking analytics event:', error);
  }
};

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if the user is on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      // Show a custom banner for iOS users
      setShowPrompt(true);
    }

    const handler = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();

      // Check if user has dismissed the prompt recently
      try {
        const dismissedDateStr = localStorage.getItem(INSTALL_PROMPT_DISMISSED_DATE_KEY);

        // If user has dismissed the prompt recently (within last 7 days), don't show it again
        if (dismissedDateStr) {
          const dismissedDate = new Date(dismissedDateStr);
          const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceDismissed < 7) {
            return;
          }
        }

        // Stash the event so it can be triggered later
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        // Show the prompt banner
        setShowPrompt(true);
      } catch (error) {
        // If there's an error with localStorage, proceed with default behavior
        console.error('Error accessing localStorage:', error);
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Track iOS install banner clicks
      trackAnalyticsEvent('install_prompt_clicked', { platform: 'iOS' });
      return;
    }

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    // Track analytics for user choice
    trackAnalyticsEvent('install_prompt_response', { outcome });

    if (outcome === 'accepted') {
      // Clear any dismissed date since they've accepted
      localStorage.removeItem(INSTALL_PROMPT_DISMISSED_DATE_KEY);
    }

    // Clear the saved prompt since it can't be used again
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Store the current date when user dismisses the prompt
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_DATE_KEY, new Date().toISOString());

    // Track dismiss action
    trackAnalyticsEvent('install_prompt_dismissed');
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
        onClick={handleInstallClick}
        className="text-sm"
      >
        Install
      </Button>
    </>
  );

  return (
    <TopBanner
      title="Install LC Report App"
      description="Install our app for a better experience with offline access and quick loading."
      isVisible={showPrompt}
      onDismiss={handleDismiss}
      actions={actions}
    />
  );
}