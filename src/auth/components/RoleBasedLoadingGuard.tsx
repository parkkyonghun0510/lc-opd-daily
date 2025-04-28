'use client';

import { ReactNode } from 'react';
import { AuthLoadingGuard } from './AuthLoadingGuard';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import { useAuth } from '@/auth/hooks/useAuth';

interface RoleBasedLoadingGuardProps {
  children: ReactNode;
  minLoadingTime?: number;
  customFallback?: ReactNode;
}

/**
 * A component that shows a role-specific loading state while authentication is being determined
 * Automatically detects the user's role and shows an appropriate loading state
 */
export function RoleBasedLoadingGuard({
  children,
  minLoadingTime = 800,
  customFallback
}: RoleBasedLoadingGuardProps) {
  const { user } = useAuth();
  const role = user?.role || 'USER';
  
  return (
    <AuthLoadingGuard
      minLoadingTime={minLoadingTime}
      fallback={customFallback || <DashboardLoadingState role={role} />}
    >
      {children}
    </AuthLoadingGuard>
  );
}

/**
 * A component that shows a role-specific loading state for admin pages
 */
export function AdminLoadingGuard({
  children,
  minLoadingTime = 800,
  customFallback
}: RoleBasedLoadingGuardProps) {
  return (
    <AuthLoadingGuard
      minLoadingTime={minLoadingTime}
      fallback={customFallback || <DashboardLoadingState role="ADMIN" />}
    >
      {children}
    </AuthLoadingGuard>
  );
}

/**
 * A component that shows a role-specific loading state for branch manager pages
 */
export function BranchManagerLoadingGuard({
  children,
  minLoadingTime = 800,
  customFallback
}: RoleBasedLoadingGuardProps) {
  return (
    <AuthLoadingGuard
      minLoadingTime={minLoadingTime}
      fallback={customFallback || <DashboardLoadingState role="BRANCH_MANAGER" />}
    >
      {children}
    </AuthLoadingGuard>
  );
}

/**
 * A component that shows a role-specific loading state for user pages
 */
export function UserLoadingGuard({
  children,
  minLoadingTime = 800,
  customFallback
}: RoleBasedLoadingGuardProps) {
  return (
    <AuthLoadingGuard
      minLoadingTime={minLoadingTime}
      fallback={customFallback || <DashboardLoadingState role="USER" />}
    >
      {children}
    </AuthLoadingGuard>
  );
}
