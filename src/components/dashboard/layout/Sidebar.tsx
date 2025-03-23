"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  FileText,
  CircleDot,
  Building2,
  History,
  CheckCircle,
} from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/theme/ThemeToggle";
import { Permission, UserRole } from "@/lib/auth/roles";
import { RoleBasedNavigation } from "./RoleBasedNavigation";
import { useSwipeable } from "react-swipeable";
import { useTransition, animated, useSpring, config } from "@react-spring/web";
import { useCompactMode, useUserData } from "@/contexts/UserDataContext";
import { RecentlyVisited } from "@/components/dashboard/navigation/RecentlyVisited";
import { useBranchPermission } from "@/hooks/useBranchPermission";
import { BranchSwitcher } from "@/components/dashboard/navigation/BranchSwitcher";

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions: Permission[];
  roles?: UserRole[];
  children?: NavigationChild[];
  branchSpecific?: boolean;
}

interface NavigationChild {
  name: string;
  href: string;
  permissions: Permission[];
  roles?: UserRole[];
}

// Define navigation items with permission requirements
const navigationItems: NavigationItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permissions: [Permission.VIEW_DASHBOARD],
  },
  {
    name: "Reports",
    href: "/dashboard/reports",
    icon: FileText,
    permissions: [Permission.VIEW_REPORTS],
    branchSpecific: true,
    children: [
      {
        name: "View Reports",
        href: "/dashboard/reports",
        permissions: [Permission.VIEW_REPORTS],
      },
      {
        name: "Create Report",
        href: "/dashboard/reports/create",
        permissions: [Permission.CREATE_REPORTS],
      },
      {
        name: "Consolidated View",
        href: "/dashboard/reports/consolidated",
        permissions: [Permission.CONSOLIDATE_REPORTS],
        roles: [UserRole.ADMIN, UserRole.BRANCH_MANAGER],
      },
    ],
  },
  {
    name: "Approvals",
    href: "/dashboard/approvals",
    icon: CheckCircle,
    permissions: [Permission.APPROVE_REPORTS],
    roles: [UserRole.ADMIN, UserRole.BRANCH_MANAGER],
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    permissions: [Permission.VIEW_ANALYTICS],
    roles: [UserRole.ADMIN, UserRole.BRANCH_MANAGER],
    children: [
      {
        name: "Overview",
        href: "/dashboard/analytics",
        permissions: [Permission.VIEW_ANALYTICS],
      },
      {
        name: "Branch Analytics",
        href: "/dashboard/analytics/branch",
        permissions: [Permission.VIEW_BRANCH_ANALYTICS],
        roles: [UserRole.ADMIN, UserRole.BRANCH_MANAGER],
      },
    ],
  },
  {
    name: "Branch Management",
    href: "/dashboard/branches",
    icon: Building2,
    permissions: [Permission.VIEW_BRANCH],
    roles: [UserRole.ADMIN, UserRole.BRANCH_MANAGER],
    children: [
      {
        name: "Branch Overview",
        href: "/dashboard/branches",
        permissions: [Permission.VIEW_BRANCH],
      },
      {
        name: "Branch Settings",
        href: "/dashboard/branches/settings",
        permissions: [Permission.MANAGE_BRANCH],
        roles: [UserRole.ADMIN],
      },
      {
        name: "Branch Hierarchy",
        href: "/dashboard/branches/hierarchy",
        permissions: [Permission.MANAGE_BRANCH],
        roles: [UserRole.ADMIN],
      },
    ],
  },
  {
    name: "User Management",
    href: "/dashboard/users",
    icon: Users,
    permissions: [Permission.VIEW_USERS],
    roles: [UserRole.ADMIN],
    children: [
      {
        name: "Users",
        href: "/dashboard/users",
        permissions: [Permission.VIEW_USERS],
      },
      {
        name: "Roles",
        href: "/dashboard/users/roles",
        permissions: [Permission.MANAGE_USERS],
        roles: [UserRole.ADMIN],
      },
    ],
  },
  {
    name: "Audit Logs",
    href: "/dashboard/audit",
    icon: History,
    permissions: [Permission.VIEW_AUDIT_LOGS],
    roles: [UserRole.ADMIN],
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    permissions: [Permission.MANAGE_SETTINGS],
    roles: [UserRole.ADMIN],
  },
];

// Define animated components with proper types
const AnimatedDiv = animated("div");

// Spring configurations for smoother animations
const SPRING_CONFIG = {
  ...config.gentle,
  tension: 220,
  friction: 21,
  precision: 0.001,
};

const MENU_SPRING_CONFIG = {
  ...config.wobbly,
  tension: 250,
  friction: 18,
  precision: 0.001,
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isCompactMode = useCompactMode();
  const { userData, isLoading } = useUserData();
  const branchPermission = useBranchPermission(userData?.branch?.id);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    };

    if (mobileOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when menu is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [mobileOpen]);

  // Swipe handlers for mobile menu
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setMobileOpen(false),
    onSwipedRight: () => setMobileOpen(true),
    trackMouse: false,
    trackTouch: true,
    delta: 50,
  });

  // Enhanced animation for menu icon with smoother rotation and scale
  const menuIconSpring = useSpring({
    to: {
      transform: mobileOpen
        ? "rotate(0deg) scale(1)"
        : "rotate(180deg) scale(1)",
      opacity: 1,
      scale: mobileOpen ? 1 : 0.9,
    },
    from: {
      opacity: 0,
      transform: "rotate(-90deg) scale(0.9)",
      scale: 0.9,
    },
    config: MENU_SPRING_CONFIG,
  });

  // Enhanced transitions for mobile menu and overlay with staggered timing
  const transitions = useTransition(mobileOpen, {
    from: {
      opacity: 0,
      transform: "translateX(-100%)",
      filter: "blur(0px)",
    },
    enter: {
      opacity: 1,
      transform: "translateX(0%)",
      filter: "blur(4px)",
    },
    leave: {
      opacity: 0,
      transform: "translateX(-100%)",
      filter: "blur(0px)",
    },
    config: SPRING_CONFIG,
  });

  // Collapse animation for desktop sidebar
  const sidebarSpring = useSpring({
    width: collapsed ? "4rem" : isCompactMode ? "14rem" : "16rem", // 64px : 224px : 256px
    config: {
      ...SPRING_CONFIG,
      clamp: true, // Prevents overshooting
    },
  });

  // Mobile menu button that shows outside the sidebar
  const MobileMenuButton = () => (
    <div className="md:hidden fixed top-3 left-4 z-[100]">
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className={cn(
          "p-2 rounded-lg",
          "bg-white dark:bg-gray-800 text-gray-700 dark:text-white",
          "hover:bg-gray-100 dark:hover:bg-gray-700",
          "border border-gray-200 dark:border-gray-700",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          "transition-colors duration-200"
        )}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        type="button"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
    </div>
  );

  // Enhanced CompanyLogo component
  const CompanyLogo = () => {
    return (
      <div className="flex items-center justify-between px-3 py-4 border-b border-gray-200 dark:border-gray-700">
        <Link href="/dashboard" className="flex items-center flex-1">
          <div className={cn(
            "relative flex-shrink-0 transition-all duration-200",
            collapsed && !isMobile ? "w-8 h-8" : isCompactMode ? "w-8 h-8" : "w-10 h-10"
          )}>
            <Image
              src="https://bhr.vectoranet.com/assets/images/logo/lc_logo.svg"
              alt="LC Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div 
            className={cn(
              "flex flex-col ml-3 transition-opacity duration-200", 
              collapsed && !isMobile ? "opacity-0" : "opacity-100"
            )}
          >
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              LC
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Daily Reports
            </span>
          </div>
        </Link>
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ml-2 transition-colors duration-200"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight size={20} />
            ) : (
              <ChevronLeft size={20} />
            )}
          </button>
        )}
      </div>
    );
  };

  const SidebarContent = () => {
    const isCompactMode = useCompactMode();
    const { userData, isLoading } = useUserData();
    const branchPermission = useBranchPermission(userData?.branch?.id);
    const pathname = usePathname();

    // If data is still loading, show skeleton UI
    if (isLoading) {
      return (
        <div className="flex flex-col h-full">
          <CompanyLogo />
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
          </div>
          <div className="flex-1 p-3 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Memoize visible navigation items to avoid redundant calculations
    const visibleNavItems = useMemo(() => {
      return {
        hasPermission: (permission: Permission) => {
          if (!userData?.permissions) return false;
          const permStr = permission.toString().toLowerCase().replace(/_/g, '');
          const permKey = `can${permStr.charAt(0).toUpperCase() + permStr.slice(1)}`;
          return userData.permissions[permKey as keyof typeof userData.permissions] === true;
        },
        hasRole: (role: UserRole) => {
          return userData?.role === role;
        }
      };
    }, [userData]);

    return (
      <div
        className={cn(
          "flex flex-col h-full",
          isCompactMode ? "text-sm" : "text-base"
        )}
      >
        <CompanyLogo />
        
        {/* Add BranchSwitcher */}
        <BranchSwitcher />
        
        <nav className="flex-1 overflow-y-auto">
          <RoleBasedNavigation>
            {({ hasPermission, hasRole }) => (
              <ul
                className={cn(
                  "space-y-1 p-2",
                  isCompactMode ? "space-y-0.5" : "space-y-1"
                )}
              >
                {navigationItems.map((item) => {
                  // Check permissions and roles
                  const hasAccess = item.permissions.some((p) => hasPermission(p));
                  const hasRoleAccess = item.roles
                    ? item.roles.some((role) => hasRole(role))
                    : true;

                  // Check branch access for branch-specific items
                  const hasBranchAccessForItem = item.branchSpecific
                    ? branchPermission.hasAccess
                    : true;

                  if (!hasAccess || !hasRoleAccess || !hasBranchAccessForItem) return null;

                  const isActive = pathname === item.href;
                  const hasActiveChild = item.children?.some(
                    (child) => pathname === child.href
                  );

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800",
                          isCompactMode ? "px-2 py-1.5" : "px-3 py-2",
                          (isActive || hasActiveChild) &&
                            "bg-gray-100 dark:bg-gray-800"
                        )}
                      >
                        <item.icon
                          className={cn(
                            isCompactMode ? "h-4 w-4" : "h-5 w-5"
                          )}
                        />
                        <span
                          className={cn(
                            "font-medium transition-opacity duration-200",
                            isCompactMode ? "text-sm" : "text-base",
                            collapsed && !isMobile ? "opacity-0 w-0" : "opacity-100"
                          )}
                        >
                          {item.name}
                        </span>
                      </Link>
                      {item.children && !collapsed && (
                        <ul
                          className={cn(
                            "ml-4 mt-1 space-y-1",
                            isCompactMode ? "space-y-0.5" : "space-y-1"
                          )}
                        >
                          {item.children.map((child) => {
                            // Check permissions and roles for child items
                            const hasChildAccess = child.permissions.some((p) =>
                              hasPermission(p)
                            );
                            const hasChildRoleAccess = child.roles
                              ? child.roles.some((role) => hasRole(role))
                              : true;

                            // Check branch access for child items if parent is branch-specific
                            const hasChildBranchAccess = item.branchSpecific
                              ? branchPermission.hasAccess
                              : true;

                            if (!hasChildAccess || !hasChildRoleAccess || !hasChildBranchAccess)
                              return null;

                            const isChildActive = pathname === child.href;

                            return (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
                                    isCompactMode ? "px-2 py-1.5" : "px-3 py-2",
                                    isChildActive &&
                                      "bg-gray-100 dark:bg-gray-800"
                                  )}
                                >
                                  <CircleDot
                                    className={cn(
                                      isCompactMode ? "h-3 w-3" : "h-4 w-4"
                                    )}
                                  />
                                  <span
                                    className={cn(
                                      "font-medium",
                                      isCompactMode ? "text-sm" : "text-base"
                                    )}
                                  >
                                    {child.name}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
                
                {/* Fallback when no items are available */}
                {navigationItems.length > 0 && navigationItems.every(item => {
                  const hasAccess = item.permissions.some((p) => hasPermission(p));
                  const hasRoleAccess = item.roles
                    ? item.roles.some((role) => hasRole(role))
                    : true;
                  const hasBranchAccessForItem = item.branchSpecific
                    ? branchPermission.hasAccess
                    : true;
                  return !hasAccess || !hasRoleAccess || !hasBranchAccessForItem;
                }) && (
                  <li className="p-3 text-center text-gray-500 dark:text-gray-400">
                    <p>No menu items available for your role.</p>
                    <p className="text-xs mt-1">Please contact an administrator.</p>
                  </li>
                )}
              </ul>
            )}
          </RoleBasedNavigation>
        </nav>
        <div
          className={cn(
            "border-t border-gray-200 dark:border-gray-700 space-y-2",
            isCompactMode ? "p-2" : "p-4"
          )}
        >
          <RecentlyVisited />
          <ThemeToggle />
        </div>
      </div>
    );
  };

  // Simplified sidebar render logic
  return (
    <>
      {isMobile && <MobileMenuButton />}

      <div
        className={cn(
          "md:flex flex-col h-screen bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700 transition-all duration-200",
          collapsed ? "md:w-16" : isCompactMode ? "md:w-56" : "md:w-64",
          isMobile ? "hidden" : "flex"
        )}
      >
        <SidebarContent />
      </div>

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-gray-600/75 dark:bg-gray-900/75 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          <div 
            className="fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700 transition-transform duration-200"
          >
            <div className="h-full">
              <SidebarContent />
            </div>
          </div>
        </>
      )}
    </>
  );
}
