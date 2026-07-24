"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  sourceIp: string | null;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
};

type Pagination = { page: number; limit: number; total: number; pages: number };

const ACTION_COLORS: Record<string, string> = {
  USER_LOGIN: "bg-blue-50 text-blue-700",
  USER_LOGIN_FAILED: "bg-red-50 text-red-700",
  USER_CREATED: "bg-green-50 text-green-700",
  USER_UPDATED: "bg-yellow-50 text-yellow-700",
  USER_DEACTIVATED: "bg-orange-50 text-orange-700",
  CONFIG_CHANGED: "bg-purple-50 text-purple-700",
  CUSTOMER_ASSIGNED: "bg-teal-50 text-teal-700",
  CUSTOMER_UNASSIGNED: "bg-gray-50 text-gray-700",
  IMPORT_STARTED: "bg-indigo-50 text-indigo-700",
  IMPORT_COMMITTED: "bg-indigo-50 text-indigo-700",
  CALCULATION_TRIGGERED: "bg-cyan-50 text-cyan-700",
  ALERT_STATUS_CHANGED: "bg-amber-50 text-amber-700",
};

function actionBadgeClass(action: string) {
  return ACTION_COLORS[action] ?? "bg-gray-50 text-gray-600";
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function AuditLogPage() {
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [pagination, setPagination] = React.useState<Pagination | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");

  async function load(p: number, q: string) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "25" });
    if (q) params.set("search", q);
    const res = await fetch(`/api/audit-log?${params}`);
    const d = await res.json();
    setEntries(d.data ?? []);
    setPagination(d.pagination ?? null);
    setLoading(false);
  }

  React.useEffect(() => { load(page, search); }, [page, search]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  function handleClear() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  return (
    <div>
      <PageHeader title="Audit Log" description="Immutable record of all sensitive actions" />
      <div className="p-6 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
          <Input
            placeholder="Filter by action or entity…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" variant="secondary">Search</Button>
          {search && (
            <Button type="button" size="sm" variant="ghost" onClick={handleClear}>Clear</Button>
          )}
        </form>

        <div className="rounded-md border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    No audit entries found
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id} className="text-sm">
                    <TableCell className="text-gray-500 whitespace-nowrap text-xs">
                      {fmtDateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      {entry.user ? (
                        <div>
                          <div className="font-medium">{entry.user.firstName} {entry.user.lastName}</div>
                          <div className="text-xs text-gray-400">{entry.user.email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionBadgeClass(entry.action)}`}>
                        {entry.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{entry.entityType}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500 max-w-[160px] truncate">
                      {entry.entityId}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">
                      {entry.sourceIp ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
