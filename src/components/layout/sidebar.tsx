"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Package,
  BarChart3,
  AlertTriangle,
  FileText,
  Upload,
  Bell,
  Settings,
  ClipboardList,
  UserCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Permission } from "@/server/authorization/permissions";
import { hasPermission } from "@/server/authorization/check-permission";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
}

const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Customers", href: "/customers", icon: Users, permission: Permission.VIEW_CUSTOMERS },
  { label: "Products", href: "/products", icon: Package, permission: Permission.VIEW_PRODUCTS },
  { label: "ROI Analysis", href: "/roi", icon: BarChart3, permission: Permission.RUN_CALCULATIONS },
  { label: "Alerts", href: "/alerts", icon: AlertTriangle, permission: Permission.VIEW_ALERTS },
  { label: "Reports", href: "/reports", icon: FileText, permission: Permission.VIEW_REPORTS },
  { label: "Imports", href: "/imports", icon: Upload, permission: Permission.IMPORT_DATA },
  { label: "Notifications", href: "/notifications", icon: Bell },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Users", href: "/admin/users", icon: Users, permission: Permission.MANAGE_USERS },
  { label: "Settings", href: "/admin/settings", icon: Settings, permission: Permission.MANAGE_SYSTEM_CONFIG },
  { label: "Audit Log", href: "/admin/audit-log", icon: ClipboardList, permission: Permission.VIEW_AUDIT_LOG },
];

interface SidebarProps {
  userPermissions: string[];
  userName: string;
  userRole: string;
}

export function Sidebar({ userPermissions, userName, userRole }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const visiblePrimary = PRIMARY_NAV.filter(
    (item) => !item.permission || userPermissions.includes(item.permission)
  );
  const visibleAdmin = ADMIN_NAV.filter(
    (item) => !item.permission || userPermissions.includes(item.permission)
  );

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-gray-900 text-white transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Brand wordmark */}
      <div className={cn("flex items-center px-4 py-5 border-b border-gray-800", collapsed && "justify-center px-2")}>
        {collapsed ? (
          <span className="text-lg font-bold text-blue-400">S</span>
        ) : (
          <span className="text-base font-bold tracking-tight">
            Sympl <span className="text-blue-400">PAS</span>
          </span>
        )}
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {visiblePrimary.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
              collapsed && "justify-center",
              isActive(item.href)
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}

        {/* Admin section */}
        {visibleAdmin.length > 0 && (
          <div className="pt-4">
            {!collapsed && (
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Admin
              </p>
            )}
            {visibleAdmin.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center",
                  isActive(item.href)
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-800 p-2 space-y-1">
        {!collapsed && (
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <div className="h-7 w-7 shrink-0 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">{userName}</p>
              <p className="truncate text-xs text-gray-400">{userRole.replace("_", " ")}</p>
            </div>
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors",
            collapsed && "justify-center"
          )}
          title="Sign out"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
