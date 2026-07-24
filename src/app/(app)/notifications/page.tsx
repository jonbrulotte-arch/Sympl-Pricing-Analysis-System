"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

function typeVariant(type: string): "destructive" | "warning" | "secondary" | "default" {
  if (type.includes("ESCALATED")) return "destructive";
  if (type.includes("ALERT")) return "warning";
  if (type.includes("APPROVED")) return "default";
  return "secondary";
}

function typeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);

  const fetchNotifications = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(unreadOnly ? { unreadOnly: "true" } : {}),
    });
    const res = await fetch(`/api/notifications?${params}`);
    const json = await res.json();
    setNotifications(json.data ?? []);
    setTotal(json.total ?? 0);
    setUnreadCount(json.unreadCount ?? 0);
    setLoading(false);
  }, [page, pageSize, unreadOnly]);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    setMarkingAll(true);
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    await fetchNotifications();
    setMarkingAll(false);
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Mentions, review updates, and system notifications"
      />
      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="unread-only"
              checked={unreadOnly}
              onCheckedChange={(v) => { setUnreadOnly(v); setPage(1); }}
            />
            <Label htmlFor="unread-only" className="text-sm cursor-pointer">
              Unread only
            </Label>
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount} unread</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" disabled={markingAll} onClick={markAllRead}>
              {markingAll ? "Marking…" : "Mark all as read"}
            </Button>
          )}
        </div>

        {/* List */}
        <div className="rounded-md border border-gray-200 bg-white divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 p-4">
                <Skeleton className="h-4 w-24" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {unreadOnly ? "No unread notifications" : "No notifications yet"}
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-4 p-4 transition-colors ${n.isRead ? "bg-white" : "bg-blue-50"}`}
              >
                <div className="pt-0.5">
                  <Badge variant={typeVariant(n.type)} className="text-xs whitespace-nowrap">
                    {typeLabel(n.type)}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${n.isRead ? "text-gray-700" : "text-gray-900"}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{n.body}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {!n.isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => markRead(n.id)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
