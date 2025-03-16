import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  FileText,
  ClipboardCheck,
  Shield,
} from "lucide-react";
import { ThemeToggle } from "../theme/ThemeToggle";
import { Permission, UserRole } from "@/lib/auth/roles";
import { RoleBasedNavigation } from "./RoleBasedNavigation";

// Define navigation items with permission requirements
const navigationItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard size={20} />,
    permissions: [Permission.VIEW_DASHBOARD],
  },
  {
    name: "View Reports",
    href: "/dashboard/reports",
    icon: <FileText size={20} />,
    permissions: [Permission.VIEW_REPORTS],
  },
  {
    name: "Approval Queue",
    href: "/dashboard/approvals",
    icon: <ClipboardCheck size={20} />,
    permissions: [Permission.APPROVE_REPORTS],
  },
  {
    name: "Consolidated View",
    href: "/dashboard/consolidated",
    icon: <BarChart3 size={20} />,
    permissions: [Permission.CONSOLIDATE_REPORTS],
  },
  {
    name: "User Management",
    href: "/dashboard/users",
    icon: <Users size={20} />,
    permissions: [Permission.VIEW_USERS, Permission.MANAGE_USERS],
  },
  {
    name: "Role Management",
    href: "/dashboard/roles",
    icon: <Shield size={20} />,
    permissions: [Permission.ASSIGN_ROLES],
    roles: [UserRole.ADMIN],
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: <Settings size={20} />,
    permissions: [Permission.VIEW_DASHBOARD],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

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

  const toggleMobileMenu = () => {
    setMobileOpen(!mobileOpen);
  };

  // Mobile menu button that shows outside the sidebar
  const MobileMenuButton = () => (
    <button
      onClick={toggleMobileMenu}
      className={cn(
        "md:hidden fixed top-3 left-4 z-[100] p-2 rounded-lg",
        "bg-white dark:bg-gray-800 text-gray-700 dark:text-white",
        "hover:bg-gray-100 dark:hover:bg-gray-700",
        "border border-gray-200 dark:border-gray-700",
        "transition-colors duration-200"
      )}
    >
      {mobileOpen ? <X size={24} /> : <Menu size={24} />}
    </button>
  );

  const CompanyLogo = () => (
    <Link href="/dashboard" className="block">
      <div
        className={cn(
          "flex items-center px-3 transition-all duration-300",
          collapsed && !isMobile ? "justify-center" : "justify-start"
        )}
      >
        <div
          className={cn(
            "relative flex-shrink-0 transition-all duration-300",
            collapsed && !isMobile ? "w-8 h-8" : "w-10 h-10"
          )}
        >
          <Image
            src="https://bhr.vectoranet.com/assets/images/logo/lc_logo.svg"
            alt="LC Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
        {(!collapsed || isMobile) && (
          <div className="flex flex-col ml-3">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              LC
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Daily Reports
            </span>
          </div>
        )}
      </div>
    </Link>
  );

  const SidebarContent = () => (
    <>
      <div className="flex flex-col space-y-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <CompanyLogo />
        {!isMobile && (
          <div className="px-3 flex justify-end">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight size={20} />
              ) : (
                <ChevronLeft size={20} />
              )}
            </button>
          </div>
        )}
      </div>
      <RoleBasedNavigation
        items={navigationItems}
        collapsed={collapsed}
        isMobile={isMobile}
        pathname={pathname}
        onMobileClick={() => isMobile && setMobileOpen(false)}
      />
      {/* <nav className="flex-1 p-2 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                pathname === item.href
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              <Icon size={20} />
              {(!collapsed || isMobile) && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav> */}

      <div className="p-2 space-y-2 border-t border-gray-200 dark:border-gray-700">
        <div className="px-3 py-2 flex items-center justify-between">
          <span
            className={cn(
              "text-sm text-gray-700 dark:text-gray-300",
              !collapsed || isMobile ? "block" : "hidden"
            )}
          >
            Theme
          </span>
          <ThemeToggle />
        </div>
        <button className="flex items-center space-x-3 w-full px-3 py-2 text-red-600 dark:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <LogOut size={20} />
          {(!collapsed || isMobile) && <span>Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Only render MobileMenuButton when isMobile is true */}
      {isMobile && <MobileMenuButton />}

      {/* Desktop Sidebar */}
      <div
        className={cn(
          "hidden md:flex flex-col h-screen bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <div
          className={cn(
            "fixed inset-0 z-40 md:hidden",
            mobileOpen ? "block" : "hidden"
          )}
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          {/* Sidebar */}
          <div className="fixed inset-y-0 left-0 flex flex-col w-64 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
