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
import { useCompactMode, useUserData } from "@/contexts/UserDataContext";
import { RecentlyVisited } from "@/components/dashboard/navigation/RecentlyVisited";
import { useBranchPermission } from "@/hooks/useBranchPermission";

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

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isCompactMode = useCompactMode();
  const { userData, isLoading } = useUserData();
  const branchPermission = useBranchPermission(userData?.branch?.id);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    };

    if (mobileOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [mobileOpen]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setMobileOpen(false),
    onSwipedRight: () => setMobileOpen(true),
    trackMouse: false,
    trackTouch: true,
    delta: 50,
  });

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
        <div className="transition-transform duration-200">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </div>
      </button>
    </div>
  );

  const CompanyLogo = () => (
    <div className="flex items-center justify-items-center px-3 py-3 border-b border-gray-200 dark:border-gray-700">
      <Link href="/dashboard" className="flex items-center flex-1">
        <div
          className={cn(
            "relative flex-shrink-0 transition-[width,opacity] duration-200",
            collapsed && !isMobile ? "w-8 h-8" : isCompactMode ? "w-8 h-8" : "w-10 h-10"
          )}
        >
          <Image
            src="/icons/icon-192x192.png"
            alt="LC Logo"
            width={24}
            height={24}
            className="object-contain w-full h-full"
            priority
          />
        </div>
        <div
          className={cn(
            "flex flex-col pl-0.5 transition-[width,opacity] duration-200 ease-out",
            collapsed && !isMobile ? "w-0 opacity-0" : "w-auto opacity-100"
          )}
        >
          <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
            LC Cash Express
          </span>
          <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
            របាយការណ៍ប្រចាំថ្ងៃ
          </span>
        </div>
      </Link>
      {!isMobile && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200",
              "text-gray-500 dark:text-gray-400",
              "focus:outline-none focus:ring-2 focus:ring-blue-500"
            )}
            title={collapsed ? "Show full sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      )}
    </div>
  );

  const SidebarContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col h-full">
          <CompanyLogo />
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
          </div>
          <div className="flex-1 p-3 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={cn("flex flex-col h-full", isCompactMode ? "text-sm" : "text-base")}>
        <CompanyLogo />
        <nav className="flex-1 gap-2">
          <RoleBasedNavigation>
            {({ hasPermission, hasRole }) => (
              <ul className={cn(
                "space-y-1",
                isCompactMode ? "space-y-0.5" : "space-y-1",
                collapsed ? "px-1 py-2" : "p-2"
              )}>
                {navigationItems.map((item) => {
                  const hasAccess = item.permissions.some((p) => hasPermission(p));
                  const hasRoleAccess = item.roles
                    ? item.roles.some((role) => hasRole(role))
                    : true;
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
                          "group relative flex items-center gap-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800",
                          isCompactMode ? "px-2 py-1.5" : "px-3 py-2",
                          (isActive || hasActiveChild) && "bg-gray-100 dark:bg-gray-800",
                          collapsed && "justify-center px-0 py-2"
                        )}
                        style={collapsed ? { justifyContent: 'center', paddingLeft: 0, paddingRight: 0 } : {}}
                      >
                        <div className={cn(
                          "relative flex items-center",
                          collapsed ? "justify-center w-full" : ""
                        )}>
                          <item.icon className={cn(isCompactMode ? "h-4 w-4" : "h-5 w-5", collapsed && "mx-auto")}/>
                          {collapsed && (
                            <div className={cn(
                              "absolute left-full ml-2 px-2 py-1.5 rounded-md bg-gray-900/90 dark:bg-gray-800/90 text-white text-xs whitespace-nowrap",
                              "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
                              "transition-all duration-200 z-50 translate-x-2",
                              "backdrop-blur-sm",
                              "border border-gray-700/50"
                            )}>
                              {item.name}
                            </div>
                          )}
                        </div>
                        {!collapsed && (
                          <span
                            className={cn(
                              "font-medium transition-all duration-200",
                              isCompactMode ? "text-sm" : "text-base"
                            )}
                          >
                            {item.name}
                          </span>
                        )}
                      </Link>
                      {item.children && (
                        <ul className={cn(
                          "mt-1 space-y-1",
                          isCompactMode ? "space-y-0.5" : "space-y-1",
                          collapsed ? "ml-0" : "ml-4"
                        )}>
                          {item.children.map((child) => {
                            const hasChildAccess = child.permissions.some(p => hasPermission(p));
                            const hasChildRoleAccess = child.roles
                              ? child.roles.some(role => hasRole(role))
                              : true;
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
                                    "group relative flex items-center gap-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
                                    isCompactMode ? "px-2 py-1.5" : "px-3 py-2",
                                    isChildActive && "bg-gray-100 dark:bg-gray-800",
                                    collapsed && "justify-center px-0 py-2"
                                  )}
                                  style={collapsed ? { justifyContent: 'center', paddingLeft: 0, paddingRight: 0 } : {}}
                                >
                                  <div className={cn(
                                    "relative flex items-center",
                                    collapsed ? "justify-center w-full" : ""
                                  )}>
                                    <CircleDot className={cn(isCompactMode ? "h-3 w-3" : "h-4 w-4", collapsed && "mx-auto")}/>
                                    {collapsed && (
                                      <div className={cn(
                                        "absolute left-full ml-2 px-2 py-1 rounded bg-gray-900 dark:bg-gray-800 text-white text-xs whitespace-nowrap",
                                        "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
                                        "transition-all duration-200 z-50 translate-x-1",
                                        "border border-gray-700 shadow-lg"
                                      )}>
                                        {child.name}
                                      </div>
                                    )}
                                  </div>
                                  {!collapsed && (
                                    <span className={cn("font-medium", isCompactMode ? "text-sm" : "text-base")}>{child.name}</span>
                                  )}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}

                {navigationItems.length > 0 && navigationItems.every(item => {
                  const hasAccess = item.permissions.some(p => hasPermission(p));
                  const hasRoleAccess = item.roles
                    ? item.roles.some(role => hasRole(role))
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
        <div className={cn(
          "border-t border-gray-200 dark:border-gray-700 space-y-2",
          isCompactMode ? "p-2" : "p-4"
        )}>
          {!collapsed && <p className="text-sm">Authorize by LC Cash Express</p>}
          {/* <RecentlyVisited /> */}
          {/* <ThemeToggle /> */}
        </div>
      </div>
    );
  };

  return (
    <>
      {isMobile && <MobileMenuButton />}

      <div
        className={cn(
          "md:flex flex-col h-screen bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700",
          "transition-all duration-200 ease-spring",
          collapsed ? "md:w-16" : isCompactMode ? "md:w-56" : "md:w-64",
          isMobile ? "hidden" : "flex",
          collapsed && "items-center"
        )}
      >
        <SidebarContent />
      </div>

      {/* Mobile overlay */}
      {isMobile && (
        <div className={cn(
          "fixed inset-0 z-40",
          "transition-all duration-200 ease-spring",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}>
          <div
            className="absolute inset-0 bg-gray-600/75 dark:bg-gray-900/75 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          <div className={cn(
            "absolute inset-y-0 left-0 z-40 flex flex-col w-64 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700",
            "transform transition-transform duration-200 ease-spring",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}>
            <div className="h-full">
              <SidebarContent />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
