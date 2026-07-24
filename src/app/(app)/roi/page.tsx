"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

type RoiRow = {
  id: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  productSku: string;
  productName: string;
  categoryName: string | null;
  customerSkuCode: string | null;
  sellingPrice: number | null;
  currentCost?: number | null;
  packageQuantity: number;
  alertStatus: string;
  reviewStatus: string;
  assignedAnalystName: string | null;
  lastCalculatedAt: string | null;
  contributionMarginPercent?: number | null;
  contributionProfit?: number | null;
  netRevenue?: number | null;
  totalVariableCost?: number | null;
};

type SavedView = {
  id: string;
  name: string;
  isDefault: boolean;
  config: { filters?: Record<string, string>; sortBy?: string; sortDir?: string; pageSize?: number };
};

function alertVariant(status: string): "success" | "warning" | "destructive" | "default" {
  if (status === "OK") return "success";
  if (status === "WARNING") return "warning";
  if (status === "HIGH" || status === "CRITICAL") return "destructive";
  return "default";
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

export default function RoiGridPage() {
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const showCost = permissions.includes("view_product_cost");
  const showMargin = permissions.includes("view_calculated_margin");
  const canRecalc = permissions.includes("run_calculations");
  const canRefreshQuotes = permissions.includes("request_shipping_quotes");
  const canManageSkus = permissions.includes("manage_customer_skus");
  const canExport = permissions.includes("export_data");

  const [data, setData] = React.useState<RoiRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [filterAlertStatus, setFilterAlertStatus] = React.useState<string>("");
  const [filterReviewStatus, setFilterReviewStatus] = React.useState<string>("");
  const [bulkLoading, setBulkLoading] = React.useState(false);
  const [bulkMessage, setBulkMessage] = React.useState("");

  const [savedViews, setSavedViews] = React.useState<SavedView[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false);
  const [viewName, setViewName] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    fetch("/api/saved-views").then((r) => r.json()).then((d) => setSavedViews(d.data ?? []));
  }, []);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (sorting.length > 0) {
      params.set("sortBy", sorting[0].id);
      params.set("sortDir", sorting[0].desc ? "desc" : "asc");
    }
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterAlertStatus) params.set("alertStatus", filterAlertStatus);
    if (filterReviewStatus) params.set("reviewStatus", filterReviewStatus);

    const res = await fetch(`/api/roi?${params}`);
    const json = await res.json();
    setData(json.data ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
    setRowSelection({});
  }, [page, pageSize, sorting, debouncedSearch, filterAlertStatus, filterReviewStatus]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const columns = React.useMemo(() => {
    const cols: ColumnDef<RoiRow>[] = [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <Link href={`/customers/${row.original.customerId}`} className="text-blue-600 hover:underline font-medium">
            {row.original.customerName}
          </Link>
        ),
      },
      { accessorKey: "productSku", header: "SKU" },
      { accessorKey: "productName", header: "Product" },
      { accessorKey: "categoryName", header: "Category", cell: ({ getValue }) => getValue() ?? "—" },
      {
        accessorKey: "sellingPrice",
        header: "Selling Price",
        cell: ({ getValue }) => fmtCurrency(getValue() as number | null),
      },
    ];

    if (showCost) {
      cols.push({
        accessorKey: "currentCost",
        header: "Unit Cost",
        cell: ({ getValue }) => fmtCurrency(getValue() as number | null),
      });
    }

    if (showMargin) {
      cols.push(
        {
          accessorKey: "contributionMarginPercent",
          header: "Margin %",
          cell: ({ getValue }) => {
            const v = getValue() as number | null;
            return v != null ? `${fmt(v, 1)}%` : "—";
          },
        },
        {
          accessorKey: "contributionProfit",
          header: "Profit",
          cell: ({ getValue }) => fmtCurrency(getValue() as number | null),
        },
        {
          accessorKey: "netRevenue",
          header: "Net Revenue",
          cell: ({ getValue }) => fmtCurrency(getValue() as number | null),
        },
      );
    }

    cols.push(
      {
        accessorKey: "alertStatus",
        header: "Alert",
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return <Badge variant={alertVariant(v)}>{v}</Badge>;
        },
      },
      {
        accessorKey: "reviewStatus",
        header: "Review",
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return <Badge variant="outline">{v.replace("_", " ")}</Badge>;
        },
      },
      {
        accessorKey: "assignedAnalystName",
        header: "Analyst",
        cell: ({ getValue }) => getValue() ?? "—",
      },
      {
        accessorKey: "lastCalculatedAt",
        header: "Last Calc",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? new Date(v).toLocaleDateString() : "—";
        },
      },
    );

    return cols;
  }, [showCost, showMargin]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: Math.ceil(total / pageSize),
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);

  async function handleBulkAction(action: string) {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    setBulkMessage("");
    try {
      const res = await fetch("/api/roi/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, customerSkuIds: selectedIds }),
      });
      const json = await res.json();
      if (res.ok) {
        setBulkMessage(`${action}: ${JSON.stringify(json.data)}`);
        if (action === "recalculate" || action === "refresh-quotes") {
          setTimeout(fetchData, 2000);
        }
      } else {
        setBulkMessage(`Error: ${json.error}`);
      }
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleSaveView() {
    const config = {
      filters: {
        ...(filterAlertStatus && { alertStatus: filterAlertStatus }),
        ...(filterReviewStatus && { reviewStatus: filterReviewStatus }),
      },
      sortBy: sorting[0]?.id,
      sortDir: sorting[0]?.desc ? "desc" : "asc",
      pageSize,
    };
    await fetch("/api/saved-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: viewName, config }),
    });
    setSaveDialogOpen(false);
    setViewName("");
    const res = await fetch("/api/saved-views");
    const d = await res.json();
    setSavedViews(d.data ?? []);
  }

  function applyView(view: SavedView) {
    const c = view.config;
    if (c.filters?.alertStatus) setFilterAlertStatus(c.filters.alertStatus);
    else setFilterAlertStatus("");
    if (c.filters?.reviewStatus) setFilterReviewStatus(c.filters.reviewStatus);
    else setFilterReviewStatus("");
    if (c.sortBy) setSorting([{ id: c.sortBy, desc: c.sortDir === "desc" }]);
    setPage(1);
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <PageHeader
        title="ROI Analysis"
        description="Cross-customer profitability analysis"
        actions={
          <div className="flex items-center gap-2">
            {savedViews.length > 0 && (
              <Select onValueChange={(id) => { const v = savedViews.find((sv) => sv.id === id); if (v) applyView(v); }}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Saved views…" /></SelectTrigger>
                <SelectContent>
                  {savedViews.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)}>Save View</Button>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search customers, SKUs, products…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="max-w-xs"
          />
          <Select value={filterAlertStatus} onValueChange={(v) => { setFilterAlertStatus(v === "ALL" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Alert status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="OK">OK</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterReviewStatus} onValueChange={(v) => { setFilterReviewStatus(v === "ALL" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Review status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All reviews</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="ESCALATED">Escalated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 border border-blue-200">
            <span className="text-sm font-medium text-blue-700">{selectedIds.length} selected</span>
            <div className="flex-1" />
            {canRecalc && (
              <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => handleBulkAction("recalculate")}>
                Recalculate
              </Button>
            )}
            {canRefreshQuotes && (
              <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => handleBulkAction("refresh-quotes")}>
                Refresh Quotes
              </Button>
            )}
            {canExport && (
              <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => handleBulkAction("export")}>
                Export
              </Button>
            )}
            {canManageSkus && (
              <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => handleBulkAction("assign-analyst")}>
                Assign Analyst
              </Button>
            )}
          </div>
        )}

        {bulkMessage && (
          <p className="text-sm text-gray-600">{bulkMessage}</p>
        )}

        {/* Data Table */}
        <div className="rounded-md border border-gray-200 bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={header.column.getCanSort() ? "cursor-pointer select-none" : ""}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" && " ↑"}
                        {header.column.getIsSorted() === "desc" && " ↓"}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-gray-400 py-8">
                    No results found
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
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
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages || 1}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Save View Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save Current View</DialogTitle></DialogHeader>
          <div className="py-2">
            <Input
              placeholder="View name…"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button disabled={!viewName.trim()} onClick={handleSaveView}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
