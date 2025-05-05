"use client";

import { useAuth, usePermissions } from '@/auth/hooks/useAuth';
import { Permission, UserRole } from '@/lib/auth/roles';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  Building2,
  CheckCircle,
  BarChart3,
  History,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  permissions?: Permission[];
  roles?: UserRole[];
  exact?: boolean;
}

/**
 * RoleBasedNavigation component
 *
 * Renders navigation items based on user role and permissions.
 */
export function RoleBasedNavigation() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { hasPermission, hasRole } = usePermissions();
  const pathname = usePathname() || '';

  // Define all possible navigation items
  const allNavigationItems: NavigationItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
      exact: true,
    },
    {
      name: 'Reports',
      href: '/dashboard/reports',
      icon: <FileText className="h-5 w-5" />,
      permissions: [Permission.VIEW_REPORTS],
    },
    {
      name: 'Approvals',
      href: '/dashboard/approvals',
      icon: <CheckCircle className="h-5 w-5" />,
      permissions: [Permission.APPROVE_REPORTS],
      roles: [UserRole.ADMIN, UserRole.BRANCH_MANAGER],
    },
    {
      name: 'Branches',
      href: '/dashboard/branches',
      icon: <Building2 className="h-5 w-5" />,
      roles: [UserRole.ADMIN],
    },
    {
      name: 'Users',
      href: '/dashboard/users',
      icon: <Users className="h-5 w-5" />,
      roles: [UserRole.ADMIN],
    },
    {
      name: 'Analytics',
      href: '/dashboard/analytics',
      icon: <BarChart3 className="h-5 w-5" />,
      permissions: [Permission.VIEW_ANALYTICS],
    },
    {
      name: 'History',
      href: '/dashboard/history',
      icon: <History className="h-5 w-5" />,
      permissions: [Permission.VIEW_AUDIT_LOGS],
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: <Settings className="h-5 w-5" />,
      permissions: [Permission.MANAGE_SETTINGS],
    },
  ];

  // Show skeleton during loading
  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  // If not authenticated, show minimal navigation
  if (!isAuthenticated || !user) {
    return (
      <div className="p-2 text-sm text-muted-foreground">
        Please log in to access navigation.
      </div>
    );
  }

  // Filter navigation items based on user role and permissions
  const filteredNavigationItems = allNavigationItems.filter(item => {
    // If no permissions or roles specified, show to everyone
    if (!item.permissions && !item.roles) {
      return true;
    }

    // Check permissions
    if (item.permissions && item.permissions.length > 0) {
      const hasRequiredPermission = item.permissions.some(permission =>
        hasPermission(permission)
      );
      if (hasRequiredPermission) {
        return true;
      }
    }

    // Check roles
    if (item.roles && item.roles.length > 0) {
      return hasRole(item.roles);
    }

    return false;
  });

  // Check if a path is active
  const isActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="space-y-1 px-2">
      {filteredNavigationItems.map((item) => (
        <Link
          key={item.name}
          href={item.href}
          className={cn(
            isActive(item.href, item.exact)
              ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white',
            'group flex items-center px-2 py-2 text-base font-medium rounded-md'
          )}
        >
          <div
            className={cn(
              isActive(item.href, item.exact)
                ? 'text-gray-500 dark:text-gray-300'
                : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-400 dark:group-hover:text-gray-300',
              'mr-3 flex-shrink-0'
            )}
          >
            {item.icon}
          </div>
          {item.name}
        </Link>
      ))}
    </nav>
  );
}
