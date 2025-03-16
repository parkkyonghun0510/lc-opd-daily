// src/components/dashboard/layout/RoleBasedNavigation.tsx
import { usePermissions } from "@/hooks/usePermissions";
import { Permission, UserRole } from "@/lib/auth/roles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  permissions?: Permission[];
  roles?: UserRole[];
}

interface RoleBasedNavigationProps {
  items: NavigationItem[];
  collapsed?: boolean;
  isMobile?: boolean;
  pathname?: string;
  onMobileClick?: () => void;
}

export function RoleBasedNavigation({
  items,
  collapsed = false,
  isMobile = false,
  pathname: propPathname,
  onMobileClick,
}: RoleBasedNavigationProps) {
  const { can, role } = usePermissions();
  // Use provided pathname from props or get it from hook
  const routePathname = usePathname();
  const pathname = propPathname || routePathname;

  // Filter navigation items based on user permissions and role
  const filteredItems = items.filter((item) => {
    // Check permissions
    if (item.permissions && item.permissions.length > 0) {
      if (!item.permissions.some((permission) => can(permission))) {
        return false;
      }
    }

    // Check roles
    if (item.roles && item.roles.length > 0) {
      if (!item.roles.includes(role)) {
        return false;
      }
    }

    return true;
  });

  return (
    <nav className="flex-1 p-2 space-y-1">
      {filteredItems.map((item) => (
        <Link
          key={item.name}
          href={item.href}
          onClick={onMobileClick}
          className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
            pathname === item.href
              ? "bg-blue-600 text-white"
              : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          {item.icon}
          {(!collapsed || isMobile) && <span>{item.name}</span>}
        </Link>
      ))}
    </nav>
  );
}
