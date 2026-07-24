"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type Customer = { id: string; name: string; code: string };

type ImportBatch = {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  skippedRows: number;
  createdAt: string;
};

function statusVariant(
  status: string
): "success" | "destructive" | "secondary" | "warning" | "default" {
  if (status === "COMPLETE") return "success";
  if (status === "FAILED") return "destructive";
  if (status === "PROCESSING" || status === "VALIDATING") return "warning";
  return "secondary";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function ImportsPage() {
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const canImport = permissions.includes("import_data");
  const canExport = permissions.includes("export_data");

  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [batches, setBatches] = React.useState<ImportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = React.useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadResult, setUploadResult] = React.useState<{
    success?: boolean;
    message?: string;
    batch?: ImportBatch;
  } | null>(null);

  async function loadCustomers() {
    const res = await fetch("/api/customers");
    const d = await res.json();
    setCustomers(d.data ?? []);
  }

  async function loadBatches() {
    const res = await fetch("/api/imports");
    const d = await res.json();
    setBatches(d.data ?? []);
    setLoadingBatches(false);
  }

  React.useEffect(() => {
    loadCustomers();
    loadBatches();
  }, []);

  async function handleDownloadTemplate() {
    if (!selectedCustomerId) return;
    const res = await fetch(`/api/exports?customerId=${selectedCustomerId}`);
    if (!res.ok) {
      const d = await res.json();
      setUploadResult({ success: false, message: d.error });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-template-${selectedCustomerId}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selectedCustomerId) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("customerId", selectedCustomerId);
      const res = await fetch("/api/imports", {
        method: "POST",
        body: formData,
      });
      const d = await res.json();
      if (res.ok) {
        setUploadResult({ success: true, batch: d.data, message: "Import complete!" });
        setFile(null);
        await loadBatches();
      } else {
        setUploadResult({ success: false, message: d.error ?? "Upload failed" });
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Imports & Exports" description="Data import and export workflows" />
      <div className="p-6 space-y-6">
        {/* Upload Panel */}
        {(canImport || canExport) && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Import / Export</h3>
              <div className="space-y-4 max-w-lg">
                <div className="space-y-1.5">
                  <Label>Customer</Label>
                  <Select
                    value={selectedCustomerId}
                    onValueChange={setSelectedCustomerId}
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
                </div>

                {canExport && (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!selectedCustomerId}
                      onClick={handleDownloadTemplate}
                    >
                      Download Template
                    </Button>
                    <p className="text-xs text-gray-400 mt-1">
                      Downloads a pre-filled Excel template for the selected customer.
                    </p>
                  </div>
                )}

                {canImport && (
                  <form onSubmit={handleUpload} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Upload File (.xlsx)</Label>
                      <input
                        type="file"
                        accept=".xlsx"
                        className="block text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </div>

                    {uploadResult && (
                      <Alert variant={uploadResult.success ? "success" : "destructive"}>
                        <AlertDescription>
                          {uploadResult.message}
                          {uploadResult.batch && (
                            <span className="ml-2 text-xs">
                              ({uploadResult.batch.successRows} ok, {uploadResult.batch.errorRows} errors,{" "}
                              {uploadResult.batch.skippedRows} skipped of {uploadResult.batch.totalRows} rows)
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      size="sm"
                      disabled={!file || !selectedCustomerId || uploading}
                    >
                      {uploading ? "Uploading…" : "Upload & Import"}
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Batch History */}
        {canImport && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Recent Imports</h3>
            <div className="rounded-md border border-gray-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Success</TableHead>
                    <TableHead>Errors</TableHead>
                    <TableHead>Skipped</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingBatches ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : batches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                        No imports yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-sm">{b.filename}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                        </TableCell>
                        <TableCell>{b.totalRows}</TableCell>
                        <TableCell className="text-green-600">{b.successRows}</TableCell>
                        <TableCell className={b.errorRows > 0 ? "text-red-600" : ""}>{b.errorRows}</TableCell>
                        <TableCell className="text-gray-500">{b.skippedRows}</TableCell>
                        <TableCell className="text-sm text-gray-500">{fmtDate(b.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
