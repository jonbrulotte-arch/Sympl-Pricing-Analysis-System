"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Customer = { id: string; name: string; code: string };

type ReportDef = {
  id: string;
  name: string;
  description: string;
  permission: string;
  requiresCustomer?: boolean;
  badge: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
};

const REPORTS: ReportDef[] = [
  {
    id: "portfolio-margin",
    name: "Portfolio Margin Report",
    description: "All customer SKUs with current selling prices, cost (if permitted), contribution margin, alert status, and review status. Sorted by customer then SKU.",
    permission: "view_reports",
    badge: "Margin",
    badgeVariant: "default",
  },
  {
    id: "alert-summary",
    name: "Alert Summary Report",
    description: "All alerts across your accessible customers, sorted by severity. Includes alert type, message, acknowledgement details, and current status.",
    permission: "view_reports",
    badge: "Alerts",
    badgeVariant: "destructive",
  },
  {
    id: "price-history",
    name: "Price History Report",
    description: "Selling price change history for a selected customer, including effective date, who recorded the change, and when.",
    permission: "view_reports",
    requiresCustomer: true,
    badge: "History",
    badgeVariant: "secondary",
  },
];

export default function ReportsPage() {
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] })?.permissions ?? [];

  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = React.useState(true);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Record<string, string>>({});
  const [downloading, setDownloading] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => { setCustomers(d.data ?? []); setLoadingCustomers(false); });
  }, []);

  const canAccess = (report: ReportDef) => permissions.includes(report.permission);

  async function handleDownload(report: ReportDef) {
    if (downloading) return;
    setDownloading(report.id);
    try {
      let url = `/api/reports/${report.id}`;
      if (report.requiresCustomer) {
        const cid = selectedCustomer[report.id];
        if (!cid) return;
        url += `?customerId=${encodeURIComponent(cid)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Failed to generate report");
        return;
      }

      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href = objUrl;
      a.download = `${report.id}-${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageHeader title="Reports" description="Download on-demand Excel reports" />
      <div className="p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((report) => {
            const accessible = canAccess(report);
            const isDownloading = downloading === report.id;
            const customerSelected = report.requiresCustomer ? !!selectedCustomer[report.id] : true;

            return (
              <div
                key={report.id}
                className={`rounded-lg border bg-white p-5 space-y-4 ${!accessible ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{report.name}</h3>
                    <Badge variant={report.badgeVariant} className="text-xs">{report.badge}</Badge>
                  </div>
                  <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

                <p className="text-sm text-gray-500">{report.description}</p>

                {report.requiresCustomer && (
                  <div className="space-y-1.5">
                    {loadingCustomers ? (
                      <Skeleton className="h-9 w-full" />
                    ) : (
                      <Select
                        value={selectedCustomer[report.id] ?? ""}
                        onValueChange={(v) => setSelectedCustomer((prev) => ({ ...prev, [report.id]: v }))}
                        disabled={!accessible}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer…" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} ({c.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full"
                  disabled={!accessible || isDownloading || !customerSelected}
                  onClick={() => handleDownload(report)}
                >
                  {isDownloading ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download Excel
                    </span>
                  )}
                </Button>

                {!accessible && (
                  <p className="text-xs text-gray-400 text-center">
                    Requires <span className="font-mono">{report.permission}</span> permission
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
