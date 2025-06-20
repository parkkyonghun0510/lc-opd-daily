"use client";

import { useEffect, useCallback, useRef } from "react";
import { useStore } from "@/auth/store";
import { handleSessionTimeout, refreshSession } from "@/auth/store/actions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface SessionActivityTrackerProps {
  // Time in minutes before showing the warning
  warningTime?: number;
  // Time in minutes before the session expires
  expiryTime?: number;
  // Check interval in seconds
  checkInterval?: number;
}

/**
 * SessionActivityTracker component
 *
 * Tracks user activity and manages session timeouts.
 * Shows a warning dialog before the session expires.
 */
export function SessionActivityTracker({
  warningTime = 25, // Show warning 5 minutes before expiry (assuming 30 min session)
  expiryTime = 30, // Default session expiry time is 30 minutes
  checkInterval = 30, // Check every 30 seconds
}: SessionActivityTrackerProps) {
  const {
    isAuthenticated,
    updateLastActivity,
    timeUntilExpiry,
    isSessionExpired,
    logout,
  } = useStore();

  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const warningDisplayed = useRef(false);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  // Convert minutes to milliseconds
  const warningTimeMs = warningTime * 60 * 1000;

  // Update activity on user interaction
  const handleUserActivity = useCallback(() => {
    if (isAuthenticated && !warningDisplayed.current) {
      updateLastActivity();
    }
  }, [isAuthenticated, updateLastActivity]);

  // Check session status
  const checkSessionStatus = useCallback(() => {
    if (!isAuthenticated) return;

    // Get time until session expiry
    const remainingTime = timeUntilExpiry();

    // If session is expired, log out
    if (isSessionExpired()) {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
      handleSessionTimeout();
      return;
    }

    // If warning threshold reached, show warning
    if (remainingTime <= warningTimeMs && !warningDisplayed.current) {
      warningDisplayed.current = true;
      setShowWarning(true);

      // Calculate time left in seconds
      const timeLeftSecs = Math.max(0, Math.floor(remainingTime / 1000));
      setTimeLeft(timeLeftSecs);

      // Start countdown timer
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }

      timerInterval.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Time's up, clear interval and log out
            if (timerInterval.current) {
              clearInterval(timerInterval.current);
            }
            handleSessionTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [isAuthenticated, timeUntilExpiry, isSessionExpired, warningTimeMs]);

  // Set up activity listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    // Events to track for activity
    const events = [
      "mousedown",
      "keypress",
      "scroll",
      "mousemove",
      "touchstart",
    ];

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity);
    });

    // Set up session checker
    const sessionChecker = setInterval(
      checkSessionStatus,
      checkInterval * 1000,
    );

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });

      clearInterval(sessionChecker);

      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [isAuthenticated, handleUserActivity, checkSessionStatus, checkInterval]);

  // Reset warning state when authentication changes
  useEffect(() => {
    if (!isAuthenticated) {
      warningDisplayed.current = false;
      setShowWarning(false);

      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    }
  }, [isAuthenticated]);

  // Format time left as MM:SS
  const formatTimeLeft = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Extend session
  const extendSession = async () => {
    const success = await refreshSession();

    if (success) {
      // Reset warning state
      warningDisplayed.current = false;
      setShowWarning(false);

      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    }
  };

  // Log out
  const handleLogout = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }
    logout();
  };

  if (!isAuthenticated || !showWarning) {
    return null;
  }

  return (
    <Dialog open={showWarning} onOpenChange={setShowWarning}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Session Timeout Warning</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your session will expire in{" "}
            <span className="font-bold">{formatTimeLeft()}</span> due to
            inactivity.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Would you like to extend your session or log out?
          </p>
        </div>
        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleLogout}>
            Log Out
          </Button>
          <Button onClick={extendSession}>Extend Session</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
