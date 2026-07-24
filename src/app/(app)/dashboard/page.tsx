"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DashboardStats = {
  totalCustomers: number;
  totalSkus: number;
  skusByAlertStatus: { OK: number; WARNING: number; HIGH: number; CRITICAL: number };
  openAlerts: { CRITICAL: number; HIGH: number; WARNING: number; INFO: number };
  averageMargin: number | null;
  recentCriticalAlerts: {
    id: string;
    alertType: string;
    severity: string;
    message: string | null;
    triggeredAt: string;
    customerName: string;
    productSku: string;
  }[];
};

function severityVariant(severity: string): "destructive" | "warning" | "secondary" | "default" {
  if (severity === "CRITICAL") return "destructive";
  if (severity === "HIGH") return "destructive";
  if (severity === "WARNING") return "warning";
  return "secondary";
}

function alertTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const showMargin = permissions.includes("view_calculated_margin");

  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d) => setStats(d.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Your pricing analysis overview" />
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Your pricing analysis overview" />
        <div className="p-6">
          <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Failed to load dashboard data.</p></CardContent></Card>
        </div>
      </div>
    );
  }

  const totalOpenAlerts = stats.openAlerts.CRITICAL + stats.openAlerts.HIGH + stats.openAlerts.WARNING + stats.openAlerts.INFO;

  return (
    <div>
      <PageHeader title="Dashboard" description="Your pricing analysis overview" />
      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalCustomers}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total SKUs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalSkus}</p>
            </CardContent>
          </Card>

          {showMargin && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Avg. Margin</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {stats.averageMargin !== null ? `${stats.averageMargin.toFixed(1)}%` : "—"}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Open Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalOpenAlerts}</p>
            </CardContent>
          </Card>
        </div>

        {/* Alert Severity Breakdown + SKU Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alert Severity Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(["CRITICAL", "HIGH", "WARNING", "INFO"] as const).map((sev) => (
                  <div key={sev} className="flex items-center justify-between">
                    <Badge variant={severityVariant(sev)}>{sev}</Badge>
                    <span className="text-lg font-semibold">{stats.openAlerts[sev]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Link href="/alerts">
                  <Button variant="outline" size="sm" className="w-full">View All Alerts</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">SKU Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(["OK", "WARNING", "HIGH", "CRITICAL"] as const).map((s) => {
                  const count = stats.skusByAlertStatus[s];
                  const pct = stats.totalSkus > 0 ? ((count / stats.totalSkus) * 100).toFixed(0) : "0";
                  return (
                    <div key={s} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={severityVariant(s)}>{s}</Badge>
                        <span className="text-sm text-gray-500">{pct}%</span>
                      </div>
                      <span className="text-lg font-semibold">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <Link href="/roi">
                  <Button variant="outline" size="sm" className="w-full">View ROI Grid</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Work Queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Work Queue — Critical &amp; High Alerts</CardTitle>
              <Link href="/alerts?status=OPEN&severity=CRITICAL">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentCriticalAlerts.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No critical or high alerts. All clear.</p>
            ) : (
              <div className="rounded-md border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Triggered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentCriticalAlerts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Badge variant={severityVariant(a.severity)}>{a.severity}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{alertTypeLabel(a.alertType)}</TableCell>
                        <TableCell className="text-sm font-medium">{a.customerName}</TableCell>
                        <TableCell className="text-sm">{a.productSku}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(a.triggeredAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
