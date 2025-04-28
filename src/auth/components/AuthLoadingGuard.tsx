'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface AuthLoadingGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  minLoadingTime?: number; // Minimum time to show loading state (prevents flashing)
}

/**
 * Component that shows a loading state while authentication is being determined
 * Prevents flickering of content or permission errors during initial load
 */
export function AuthLoadingGuard({
  children,
  fallback,
  minLoadingTime = 500, // Default minimum loading time of 500ms
}: AuthLoadingGuardProps) {
  const { isLoading, isAuthenticated } = useAuth();
  const [showContent, setShowContent] = useState(false);
  
  // Track when we started loading
  const [loadStartTime] = useState(Date.now());
  
  // Determine when to show content based on auth state and minimum loading time
  useEffect(() => {
    if (!isLoading) {
      const currentTime = Date.now();
      const elapsedTime = currentTime - loadStartTime;
      
      if (elapsedTime >= minLoadingTime) {
        // We've loaded and met the minimum time, show content immediately
        setShowContent(true);
      } else {
        // We've loaded but haven't met the minimum time, wait for the remainder
        const remainingTime = minLoadingTime - elapsedTime;
        const timer = setTimeout(() => {
          setShowContent(true);
        }, remainingTime);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, loadStartTime, minLoadingTime]);
  
  // Show loading state if still loading or haven't met minimum time
  if (isLoading || !showContent) {
    return fallback || (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }
  
  // Show content once loaded and minimum time has passed
  return <>{children}</>;
}

/**
 * Component that shows a loading state while authentication is being determined
 * and redirects unauthenticated users
 */
export function AuthenticatedGuard({
  children,
  loadingFallback,
  unauthenticatedFallback,
  minLoadingTime = 500,
}: {
  children: ReactNode;
  loadingFallback?: ReactNode;
  unauthenticatedFallback?: ReactNode;
  minLoadingTime?: number;
}) {
  const { isLoading, isAuthenticated } = useAuth();
  const [showContent, setShowContent] = useState(false);
  
  // Track when we started loading
  const [loadStartTime] = useState(Date.now());
  
  // Determine when to show content based on auth state and minimum loading time
  useEffect(() => {
    if (!isLoading) {
      const currentTime = Date.now();
      const elapsedTime = currentTime - loadStartTime;
      
      if (elapsedTime >= minLoadingTime) {
        // We've loaded and met the minimum time, show content immediately
        setShowContent(true);
      } else {
        // We've loaded but haven't met the minimum time, wait for the remainder
        const remainingTime = minLoadingTime - elapsedTime;
        const timer = setTimeout(() => {
          setShowContent(true);
        }, remainingTime);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, loadStartTime, minLoadingTime]);
  
  // Show loading state if still loading or haven't met minimum time
  if (isLoading || !showContent) {
    return loadingFallback || (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }
  
  // Show unauthenticated fallback if not authenticated
  if (!isAuthenticated) {
    return unauthenticatedFallback || (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">Please sign in to access this content</p>
        </div>
      </div>
    );
  }
  
  // Show content once authenticated and loaded
  return <>{children}</>;
}
