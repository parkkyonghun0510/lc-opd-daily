import { lazy, Suspense, ComponentType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Debug Components
export const LazyReportSSEDiagnostics = lazy(() => import('@/components/debug/ReportSSEDiagnostics'));

// Admin Components
export const LazyRealtimeMonitoringDashboard = lazy(() => import('@/components/admin/RealtimeMonitoringDashboard'));
export const LazySSEDashboard = lazy(() => import('@/components/admin/SSEDashboard'));
export const LazyNotificationStatsDashboard = lazy(() => import('@/components/admin/NotificationStatsDashboard'));
export const LazyAdminOverview = lazy(() => import('@/components/admin/AdminOverview'));
export const LazySSEMonitor = lazy(() => import('@/components/admin/SSEMonitor'));
export const LazyUserRoleManager = lazy(() => import('@/components/admin/UserRoleManager'));

// Dashboard Components
export const LazyEnvironmentStatusDashboard = lazy(() => import('@/components/dashboard/EnvironmentStatusDashboard'));
export const LazyRoleBasedDashboard = lazy(() => import('@/components/dashboard/RoleBasedDashboard'));
export const LazyDashboardHybridContent = lazy(() => import('@/components/dashboard/DashboardHybridContent'));
export const LazyBranchManagerDashboardContent = lazy(() => import('@/components/dashboard/BranchManagerDashboardContent'));
export const LazyUserDashboardContent = lazy(() => import('@/components/dashboard/UserDashboardContent'));
export const LazyCommandPalette = lazy(() => import('@/components/dashboard/search/CommandPalette'));
export const LazyAnalyticsChart = lazy(() => import('@/components/dashboard/widgets/AnalyticsChart'));

// Profile Components
export const LazyProfileEditForm = lazy(() => import('@/app/profile/edit/ProfileEditForm'));

// Notification Components
export const LazyNotificationCenter = lazy(() => import('@/components/notifications/NotificationCenter'));

// Auth Components
export const LazyStoreSynchronizer = lazy(() => import('@/components/auth/StoreSynchronizer').then(module => ({ default: module.StoreSynchronizer })));

// Generic loading fallback components
export const CardSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </CardContent>
  </Card>
);

export const FormSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-10 w-32" />
  </div>
);

export const DiagnosticSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </CardContent>
  </Card>
);

// Higher-order component for lazy loading with custom fallback
export function withLazyLoading<T extends object>(
  LazyComponent: ComponentType<T>,
  fallback: React.ReactNode = <CardSkeleton />
) {
  return function LazyWrapper(props: T) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Pre-configured lazy components with appropriate fallbacks
export const LazyReportSSEDiagnosticsWithFallback = withLazyLoading(
  LazyReportSSEDiagnostics,
  <DiagnosticSkeleton />
);

export const LazyProfileEditFormWithFallback = withLazyLoading(
  LazyProfileEditForm,
  <FormSkeleton />
);

export const LazyDashboardAnalyticsWithFallback = withLazyLoading(
  LazyDashboardAnalytics,
  <CardSkeleton />
);

export const LazyNotificationCenterWithFallback = withLazyLoading(
  LazyNotificationCenter,
  <CardSkeleton />
);