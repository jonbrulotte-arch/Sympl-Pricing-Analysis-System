"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Product = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  upc: string | null;
  isActive: boolean;
  description: string | null;
  unitOfMeasure: string | null;
  category?: { id: string; name: string } | null;
  // UPC dimensions
  length: string | null;
  width: string | null;
  height: string | null;
  weight: string | null;
  // Shipping dimensions
  shippingLength: string | null;
  shippingWidth: string | null;
  shippingHeight: string | null;
  shippingWeight: string | null;
  // Cost (only for authorized users)
  currentCost?: string | null;
  futureCost?: string | null;
  costEffectiveDate?: string | null;
  futureCostEffectiveDate?: string | null;
  costSource?: string | null;
};

type CostHistory = {
  id: string;
  cost: string;
  effectiveDate: string;
  source: string | null;
  createdAt: string;
  recordedBy?: { name: string | null; email: string } | null;
};

function dim(v: string | null | undefined) {
  return v ? Number(v).toFixed(4) : "—";
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return iso.split("T")[0];
}

function EditCostDialog({
  product,
  onSaved,
}: {
  product: Product;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({
    currentCost: product.currentCost ? Number(product.currentCost).toFixed(4) : "",
    futureCost: product.futureCost ? Number(product.futureCost).toFixed(4) : "",
    costEffectiveDate: fmtDate(product.costEffectiveDate),
    futureCostEffectiveDate: fmtDate(product.futureCostEffectiveDate),
    costSource: product.costSource ?? "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${product.id}/cost`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentCost: parseFloat(form.currentCost),
          ...(form.futureCost && { futureCost: parseFloat(form.futureCost) }),
          costEffectiveDate: form.costEffectiveDate || new Date().toISOString().split("T")[0],
          ...(form.futureCostEffectiveDate && { futureCostEffectiveDate: form.futureCostEffectiveDate }),
          ...(form.costSource && { costSource: form.costSource }),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Save failed");
      } else {
        setOpen(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Update Cost</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Update Product Cost</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Current Cost *</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                required
                value={form.currentCost}
                onChange={(e) => setForm({ ...form, currentCost: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={form.costEffectiveDate}
                onChange={(e) => setForm({ ...form, costEffectiveDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Future Cost</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={form.futureCost}
                onChange={(e) => setForm({ ...form, futureCost: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Future Cost Effective</Label>
              <Input
                type="date"
                value={form.futureCostEffectiveDate}
                onChange={(e) => setForm({ ...form, futureCostEffectiveDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Input
              value={form.costSource}
              onChange={(e) => setForm({ ...form, costSource: e.target.value })}
              placeholder="e.g. Vendor invoice"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const productId = params.productId;
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const canManage = permissions.includes("manage_products");
  const canSeeCost = permissions.includes("view_product_cost");
  const canEditCost = permissions.includes("edit_product_cost");

  const [product, setProduct] = React.useState<Product | null>(null);
  const [costHistory, setCostHistory] = React.useState<CostHistory[]>([]);
  const [loading, setLoading] = React.useState(true);

  async function load() {
    const promises: Promise<Response>[] = [fetch(`/api/products/${productId}`)];
    if (canSeeCost) promises.push(fetch(`/api/products/${productId}/cost-history`));
    const results = await Promise.all(promises);
    const prodData = await results[0].json();
    setProduct(prodData.data);
    if (results[1]) {
      const histData = await results[1].json();
      setCostHistory(histData.data ?? []);
    }
    setLoading(false);
  }

  React.useEffect(() => { load(); }, [productId, canSeeCost]);

  if (loading) {
    return (
      <div>
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>Product not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={product.name}
        description={product.sku}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={product.isActive ? "success" : "secondary"}>
              {product.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        }
      />
      <div className="p-6 space-y-6">
        {/* Identity + Dimensions */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Identity */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Product Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">SKU</span>
                  <span className="font-mono">{product.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Brand</span>
                  <span>{product.brand ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">UPC</span>
                  <span className="font-mono">{product.upc ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span>{product.category?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Unit of Measure</span>
                  <span>{product.unitOfMeasure ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <Badge variant={product.isActive ? "success" : "secondary"}>
                    {product.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              {product.description && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-500 mb-1">Description</p>
                  <p className="text-sm text-gray-700">{product.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Dimensions */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Dimensions</h3>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">UPC / Retail Unit</p>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  {[
                    ["L", product.length],
                    ["W", product.width],
                    ["H", product.height],
                    ["Wt", product.weight],
                  ].map(([label, val]) => (
                    <div key={label} className="rounded border border-gray-100 p-2 text-center">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="font-mono">{dim(val)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Shipping</p>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  {[
                    ["L", product.shippingLength],
                    ["W", product.shippingWidth],
                    ["H", product.shippingHeight],
                    ["Wt", product.shippingWeight],
                  ].map(([label, val]) => (
                    <div key={label} className="rounded border border-gray-100 p-2 text-center">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="font-mono">{dim(val)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cost section — authorized users only */}
        {canSeeCost && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Cost Information</h3>
                {canEditCost && (
                  <EditCostDialog product={product} onSaved={load} />
                )}
              </div>
              <div className="grid grid-cols-3 gap-6 text-sm">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Current Cost</p>
                  <p className="mt-1 text-lg font-semibold">
                    {product.currentCost ? `$${Number(product.currentCost).toFixed(4)}` : "—"}
                  </p>
                  <p className="text-xs text-gray-400">Effective: {fmtDate(product.costEffectiveDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Future Cost</p>
                  <p className="mt-1 text-lg font-semibold">
                    {product.futureCost ? `$${Number(product.futureCost).toFixed(4)}` : "—"}
                  </p>
                  <p className="text-xs text-gray-400">Effective: {fmtDate(product.futureCostEffectiveDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Source</p>
                  <p className="mt-1">{product.costSource ?? "—"}</p>
                </div>
              </div>

              {costHistory.length > 0 && (
                <div className="mt-6 border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Cost History</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cost</TableHead>
                        <TableHead>Effective Date</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Recorded By</TableHead>
                        <TableHead>Recorded At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costHistory.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="font-mono">${Number(h.cost).toFixed(4)}</TableCell>
                          <TableCell>{fmtDate(h.effectiveDate)}</TableCell>
                          <TableCell>{h.source ?? "—"}</TableCell>
                          <TableCell>{h.recordedBy?.name ?? h.recordedBy?.email ?? "—"}</TableCell>
                          <TableCell>{fmtDate(h.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
