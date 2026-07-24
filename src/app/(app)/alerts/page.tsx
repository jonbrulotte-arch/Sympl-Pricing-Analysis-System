"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type AlertItem = {
  id: string;
  alertType: string;
  severity: string;
  status: string;
  message: string | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  suppressedReason: string | null;
  customerSku: {
    id: string;
    customer: { id: string; name: string; code: string };
    product: { sku: string; name: string };
  };
  history: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: string;
    changedBy: { firstName: string; lastName: string } | null;
  }[];
};

function severityVariant(severity: string): "destructive" | "warning" | "secondary" | "default" {
  if (severity === "CRITICAL" || severity === "HIGH") return "destructive";
  if (severity === "WARNING") return "warning";
  return "secondary";
}

function statusVariant(status: string): "destructive" | "warning" | "success" | "secondary" | "default" {
  if (status === "OPEN") return "destructive";
  if (status === "ACKNOWLEDGED") return "warning";
  if (status === "RESOLVED") return "success";
  if (status === "SUPPRESSED") return "secondary";
  return "default";
}

function alertTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AlertsPage() {
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const canManage = permissions.includes("manage_alerts");

  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [filterSeverity, setFilterSeverity] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [actionAlertId, setActionAlertId] = React.useState<string | null>(null);
  const [actionType, setActionType] = React.useState<string>("");
  const [actionNote, setActionNote] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const fetchAlerts = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filterSeverity) params.set("severity", filterSeverity);
    if (filterStatus) params.set("status", filterStatus);

    const res = await fetch(`/api/alerts?${params}`);
    const json = await res.json();
    setAlerts(json.data ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [page, pageSize, filterSeverity, filterStatus]);

  React.useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  async function handleAction() {
    if (!actionAlertId || !actionType) return;
    setActionLoading(true);
    try {
      await fetch(`/api/alerts/${actionAlertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          ...(actionType === "suppress" ? { reason: actionNote } : { note: actionNote || undefined }),
        }),
      });
      setActionAlertId(null);
      setActionType("");
      setActionNote("");
      await fetchAlerts();
    } finally {
      setActionLoading(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <PageHeader title="Alerts" description="Profitability and data quality alerts across all customers" />
      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterSeverity} onValueChange={(v) => { setFilterSeverity(v === "ALL" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All severities</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v === "ALL" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
              <SelectItem value="SUPPRESSED">Suppressed</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Alert Table */}
        <div className="rounded-md border border-gray-200 bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Triggered</TableHead>
                {canManage && <TableHead className="w-32">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: canManage ? 8 : 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 8 : 7} className="text-center text-gray-400 py-8">
                    No alerts found
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map((a) => (
                  <React.Fragment key={a.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                    >
                      <TableCell><Badge variant={severityVariant(a.severity)}>{a.severity}</Badge></TableCell>
                      <TableCell><Badge variant={statusVariant(a.status)}>{a.status}</Badge></TableCell>
                      <TableCell className="text-sm">{alertTypeLabel(a.alertType)}</TableCell>
                      <TableCell className="text-sm font-medium">{a.customerSku.customer.name}</TableCell>
                      <TableCell className="text-sm">{a.customerSku.product.sku}</TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs truncate">{a.message ?? "—"}</TableCell>
                      <TableCell className="text-sm text-gray-500">{new Date(a.triggeredAt).toLocaleDateString()}</TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {a.status === "OPEN" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setActionAlertId(a.id); setActionType("acknowledge"); }}
                                >
                                  Ack
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setActionAlertId(a.id); setActionType("suppress"); }}
                                >
                                  Suppress
                                </Button>
                              </>
                            )}
                            {(a.status === "OPEN" || a.status === "ACKNOWLEDGED" || a.status === "SUPPRESSED") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setActionAlertId(a.id); setActionType("resolve"); }}
                              >
                                Resolve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                    {expandedId === a.id && a.history.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={canManage ? 8 : 7} className="bg-gray-50">
                          <div className="py-2 px-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">History</p>
                            <div className="space-y-1">
                              {a.history.map((h) => (
                                <div key={h.id} className="flex items-center gap-2 text-xs text-gray-600">
                                  <span className="text-gray-400">{new Date(h.createdAt).toLocaleString()}</span>
                                  <span>{h.fromStatus ?? "—"} → {h.toStatus}</span>
                                  {h.changedBy && <span className="text-gray-500">by {h.changedBy.firstName} {h.changedBy.lastName}</span>}
                                  {h.note && <span className="italic">"{h.note}"</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages || 1}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionAlertId} onOpenChange={(open) => { if (!open) { setActionAlertId(null); setActionType(""); setActionNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "acknowledge" && "Acknowledge Alert"}
              {actionType === "suppress" && "Suppress Alert"}
              {actionType === "resolve" && "Resolve Alert"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>{actionType === "suppress" ? "Reason (required)" : "Note (optional)"}</Label>
            <Textarea
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder={actionType === "suppress" ? "Why is this alert being suppressed?" : "Add a note…"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionAlertId(null); setActionType(""); setActionNote(""); }}>Cancel</Button>
            <Button
              disabled={actionLoading || (actionType === "suppress" && !actionNote.trim())}
              onClick={handleAction}
            >
              {actionLoading ? "Processing…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
