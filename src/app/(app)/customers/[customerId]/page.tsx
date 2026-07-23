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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Customer = {
  id: string;
  name: string;
  code: string;
  status: string;
  defaultShippingTerms: string | null;
  creditLimit: string | null;
  notes: string | null;
  paymentTermId: string | null;
};

type Contact = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

type Allocation = {
  id: string;
  name: string;
  calculationType: string;
  rate: string | null;
  amount: string | null;
  effectiveDate: string;
  expirationDate: string | null;
  isActive: boolean;
  isIncludedInMargin: boolean;
};

type MarginRequirement = {
  id: string;
  minimumMarginPercent: string;
  warningThresholdPercent: string;
  criticalThresholdPercent: string;
  calculationMethod: string;
  notes: string | null;
} | null;

type CustomerSku = {
  id: string;
  customerSkuCode: string | null;
  sellingPrice: string | null;
  packageQuantity: number;
  alertStatus: string;
  reviewStatus: string;
  product: {
    id: string;
    sku: string;
    name: string;
    brand: string | null;
    category?: { name: string } | null;
  };
};

type PaymentTerm = { id: string; name: string };
type Product = { id: string; sku: string; name: string };

type CalculationResult = {
  id: string;
  contributionMarginPercent: string;
  contributionProfit: string;
  netRevenue: string;
  totalVariableCost: string;
  alertStatus: string;
  calculatedAt: string;
  calculationTrace: {
    engineVersion: string;
    inputs: {
      sellingPrice: string | null;
      productCost: string | null;
      shippingCost: string;
      allocations: { name: string; type: string; rate: string | null; computedAmount: number }[];
      shippingTerms: string;
      packageQuantity: number;
    };
    intermediates: {
      revenueBasedAllowances: string;
      netRevenue: string;
      totalVariableCost: string;
      contributionProfit: string;
    };
    outputs: {
      contributionMarginPercent: string;
      requiredMinimumMargin: string;
      varianceFromRequired: string;
      alertStatus: string;
    };
    appliedOverrides: string[];
    dataQuality: { missingSellingPrice: boolean; missingProductCost: boolean };
  };
} | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusVariant(status: string): "success" | "secondary" | "warning" | "default" {
  if (status === "ACTIVE") return "success";
  if (status === "INACTIVE") return "secondary";
  if (status === "PROSPECT") return "warning";
  return "default";
}

function alertVariant(status: string): "success" | "secondary" | "warning" | "destructive" | "default" {
  if (status === "OK") return "success";
  if (status === "WARNING") return "warning";
  if (status === "HIGH" || status === "CRITICAL") return "destructive";
  return "default";
}

function fmtDate(iso: string) {
  return iso.split("T")[0];
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

function ContactsTab({
  customerId,
  canManage,
}: {
  customerId: string;
  canManage: boolean;
}) {
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", title: "", email: "", phone: "", isPrimary: false });
  const [saving, setSaving] = React.useState(false);

  async function load() {
    const res = await fetch(`/api/customers/${customerId}/contacts`);
    const d = await res.json();
    setContacts(d.data ?? []);
    setLoading(false);
  }

  React.useEffect(() => { load(); }, [customerId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/customers/${customerId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          ...(form.title && { title: form.title }),
          ...(form.email && { email: form.email }),
          ...(form.phone && { phone: form.phone }),
          isPrimary: form.isPrimary,
        }),
      });
      setAddOpen(false);
      setForm({ name: "", title: "", email: "", phone: "", isPrimary: false });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/customers/${customerId}/contacts/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Add Contact</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}
      <div className="rounded-md border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Primary</TableHead>
              {canManage && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            ) : contacts.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-6">No contacts</TableCell></TableRow>
            ) : (
              contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.title ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.isPrimary ? <Badge variant="success">Primary</Badge> : "—"}</TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(c.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Allocations Tab ──────────────────────────────────────────────────────────

function AllocationsTab({
  customerId,
  canManage,
}: {
  customerId: string;
  canManage: boolean;
}) {
  const [allocations, setAllocations] = React.useState<Allocation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    calculationType: "PERCENT_OF_SELLING_PRICE",
    rate: "",
    amount: "",
    effectiveDate: new Date().toISOString().split("T")[0],
    priority: "0",
    notes: "",
  });

  async function load() {
    const res = await fetch(`/api/customers/${customerId}/allocations`);
    const d = await res.json();
    setAllocations(d.data ?? []);
    setLoading(false);
  }

  React.useEffect(() => { load(); }, [customerId]);

  const isPercentType = form.calculationType.startsWith("PERCENT_");
  const isFixedType = form.calculationType.startsWith("FIXED_");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/customers/${customerId}/allocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          calculationType: form.calculationType,
          ...(isPercentType && form.rate && { rate: parseFloat(form.rate) }),
          ...(isFixedType && form.amount && { amount: parseFloat(form.amount) }),
          effectiveDate: form.effectiveDate,
          priority: parseInt(form.priority, 10),
          ...(form.notes && { notes: form.notes }),
        }),
      });
      setAddOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function formatRate(alloc: Allocation) {
    if (alloc.rate) return `${(parseFloat(alloc.rate) * 100).toFixed(2)}%`;
    if (alloc.amount) return `$${parseFloat(alloc.amount).toFixed(4)}`;
    return "—";
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Add Allocation</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Allocation</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.calculationType} onValueChange={(v) => setForm({ ...form, calculationType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT_OF_SELLING_PRICE">% of Selling Price</SelectItem>
                      <SelectItem value="PERCENT_OF_NET_REVENUE">% of Net Revenue</SelectItem>
                      <SelectItem value="PERCENT_OF_COST">% of Cost</SelectItem>
                      <SelectItem value="FIXED_PER_UNIT">Fixed per Unit</SelectItem>
                      <SelectItem value="FIXED_PER_ORDER">Fixed per Order</SelectItem>
                      <SelectItem value="FIXED_PER_SHIPMENT">Fixed per Shipment</SelectItem>
                      <SelectItem value="FIXED_PER_SKU">Fixed per SKU</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isPercentType && (
                  <div className="space-y-1.5">
                    <Label>Rate (0–1, e.g. 0.05 = 5%)</Label>
                    <Input type="number" step="0.0001" min="0" max="1" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
                  </div>
                )}
                {isFixedType && (
                  <div className="space-y-1.5">
                    <Label>Amount ($)</Label>
                    <Input type="number" step="0.0001" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Effective Date</Label>
                    <Input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
                  </div>
                </div>
                {form.calculationType === "CUSTOM" && (
                  <div className="space-y-1.5">
                    <Label>Notes (required for CUSTOM)</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}
      <div className="rounded-md border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Rate / Amount</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>In Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            ) : allocations.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-6">No allocations</TableCell></TableRow>
            ) : (
              allocations.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{a.calculationType.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell>{formatRate(a)}</TableCell>
                  <TableCell>{fmtDate(a.effectiveDate)}</TableCell>
                  <TableCell>
                    <Badge variant={a.isIncludedInMargin ? "success" : "secondary"}>
                      {a.isIncludedInMargin ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Margin Requirements Tab ──────────────────────────────────────────────────

function MarginRequirementsTab({
  customerId,
  canManage,
}: {
  customerId: string;
  canManage: boolean;
}) {
  const [margin, setMargin] = React.useState<MarginRequirement>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    minimumMarginPercent: "",
    warningThresholdPercent: "",
    criticalThresholdPercent: "",
    calculationMethod: "CONTRIBUTION_MARGIN",
    notes: "",
  });
  const [error, setError] = React.useState("");

  async function load() {
    const res = await fetch(`/api/customers/${customerId}/margin-requirements`);
    const d = await res.json();
    setMargin(d.data);
    if (d.data) {
      setForm({
        minimumMarginPercent: d.data.minimumMarginPercent,
        warningThresholdPercent: d.data.warningThresholdPercent,
        criticalThresholdPercent: d.data.criticalThresholdPercent,
        calculationMethod: d.data.calculationMethod,
        notes: d.data.notes ?? "",
      });
    }
    setLoading(false);
  }

  React.useEffect(() => { load(); }, [customerId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/margin-requirements`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minimumMarginPercent: parseFloat(form.minimumMarginPercent),
          warningThresholdPercent: parseFloat(form.warningThresholdPercent),
          criticalThresholdPercent: parseFloat(form.criticalThresholdPercent),
          calculationMethod: form.calculationMethod,
          ...(form.notes && { notes: form.notes }),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Save failed");
      } else {
        setEditing(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-40 w-full" />;

  return (
    <Card>
      <CardContent className="pt-6">
        {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Minimum Margin %</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={form.minimumMarginPercent}
                  onChange={(e) => setForm({ ...form, minimumMarginPercent: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Warning Threshold %</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={form.warningThresholdPercent}
                  onChange={(e) => setForm({ ...form, warningThresholdPercent: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Critical Threshold %</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={form.criticalThresholdPercent}
                  onChange={(e) => setForm({ ...form, criticalThresholdPercent: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Calculation Method</Label>
              <Select value={form.calculationMethod} onValueChange={(v) => setForm({ ...form, calculationMethod: v })}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTRIBUTION_MARGIN">Contribution Margin</SelectItem>
                  <SelectItem value="GROSS_MARGIN">Gross Margin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        ) : margin ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Minimum Margin</p>
                <p className="mt-1 text-2xl font-semibold text-green-600">{parseFloat(margin.minimumMarginPercent).toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Warning Threshold</p>
                <p className="mt-1 text-2xl font-semibold text-yellow-600">{parseFloat(margin.warningThresholdPercent).toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Critical Threshold</p>
                <p className="mt-1 text-2xl font-semibold text-red-600">{parseFloat(margin.criticalThresholdPercent).toFixed(2)}%</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">Method: {margin.calculationMethod.replace(/_/g, " ")}</p>
            {margin.notes && <p className="text-sm text-gray-600">{margin.notes}</p>}
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-400 mb-4">No margin requirements set</p>
            {canManage && (
              <Button size="sm" onClick={() => setEditing(true)}>Set Requirements</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── SKUs Tab ─────────────────────────────────────────────────────────────────

function CalculationPanel({ calc }: { calc: NonNullable<CalculationResult> }) {
  const t = calc.calculationTrace;
  const margin = parseFloat(calc.contributionMarginPercent);
  const required = parseFloat(t.outputs.requiredMinimumMargin);
  const variance = parseFloat(t.outputs.varianceFromRequired);
  const varColor = variance >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-gray-200 p-3">
          <div className="text-xs text-gray-500 mb-1">Contribution Margin</div>
          <div className="text-2xl font-bold">{margin.toFixed(2)}%</div>
          <div className={`text-xs mt-0.5 ${varColor}`}>
            {variance >= 0 ? "+" : ""}{variance.toFixed(2)}% vs required {required.toFixed(2)}%
          </div>
        </div>
        <div className="rounded-md border border-gray-200 p-3">
          <div className="text-xs text-gray-500 mb-1">Contribution Profit</div>
          <div className="text-2xl font-bold">${parseFloat(calc.contributionProfit).toFixed(4)}</div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Calculation Trace</div>
        <table className="w-full text-xs">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-1 text-gray-500">Selling Price</td>
              <td className="py-1 text-right font-mono">{t.inputs.sellingPrice ? `$${t.inputs.sellingPrice}` : "—"}</td>
            </tr>
            {t.inputs.allocations.filter(a => ["PERCENT_OF_SELLING_PRICE","PERCENT_OF_NET_REVENUE"].includes(a.type)).map((a, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1 text-gray-500 pl-3">− {a.name}</td>
                <td className="py-1 text-right font-mono text-red-600">-${a.computedAmount.toFixed(4)}</td>
              </tr>
            ))}
            <tr className="border-b border-gray-200 font-semibold">
              <td className="py-1">Net Revenue</td>
              <td className="py-1 text-right font-mono">${t.intermediates.netRevenue}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1 text-gray-500">Product Cost</td>
              <td className="py-1 text-right font-mono">{t.inputs.productCost ? `$${t.inputs.productCost}` : "—"}</td>
            </tr>
            {t.inputs.allocations.filter(a => !["PERCENT_OF_SELLING_PRICE","PERCENT_OF_NET_REVENUE"].includes(a.type) && a.computedAmount > 0).map((a, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1 text-gray-500 pl-3">+ {a.name}</td>
                <td className="py-1 text-right font-mono">${a.computedAmount.toFixed(4)}</td>
              </tr>
            ))}
            <tr className="border-b border-gray-200 font-semibold">
              <td className="py-1">Total Variable Cost</td>
              <td className="py-1 text-right font-mono">${t.intermediates.totalVariableCost}</td>
            </tr>
            <tr className="font-bold">
              <td className="py-1">Contribution Profit</td>
              <td className="py-1 text-right font-mono">${t.intermediates.contributionProfit}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {(t.dataQuality.missingSellingPrice || t.dataQuality.missingProductCost) && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          {t.dataQuality.missingSellingPrice && <div>⚠ Missing selling price — cannot calculate margin</div>}
          {t.dataQuality.missingProductCost && <div>⚠ Missing product cost — cannot calculate margin</div>}
        </div>
      )}

      <div className="text-xs text-gray-400">
        Calculated {new Date(calc.calculatedAt).toLocaleString()} · Engine v{t.engineVersion}
      </div>
    </div>
  );
}

function SkusTab({
  customerId,
  canManage,
  canRunCalcs,
}: {
  customerId: string;
  canManage: boolean;
  canRunCalcs: boolean;
}) {
  const [skus, setSkus] = React.useState<CustomerSku[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ productId: "", sellingPrice: "", packageQuantity: "1" });
  const [calcDialogSku, setCalcDialogSku] = React.useState<CustomerSku | null>(null);
  const [calcResult, setCalcResult] = React.useState<CalculationResult>(null);
  const [calcLoading, setCalcLoading] = React.useState(false);
  const [recalculating, setRecalculating] = React.useState<string | null>(null);

  async function load() {
    const [skuRes, prodRes] = await Promise.all([
      fetch(`/api/customers/${customerId}/skus`),
      fetch("/api/products"),
    ]);
    const skuData = await skuRes.json();
    const prodData = await prodRes.json();
    setSkus(skuData.data ?? []);
    setProducts(prodData.data ?? []);
    setLoading(false);
  }

  React.useEffect(() => { load(); }, [customerId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/customers/${customerId}/skus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: form.productId,
          ...(form.sellingPrice && { sellingPrice: parseFloat(form.sellingPrice) }),
          packageQuantity: parseInt(form.packageQuantity, 10),
        }),
      });
      setAddOpen(false);
      setForm({ productId: "", sellingPrice: "", packageQuantity: "1" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/customers/${customerId}/skus/${id}`, { method: "DELETE" });
    await load();
  }

  async function handleRecalculate(skuId: string) {
    setRecalculating(skuId);
    try {
      await fetch(`/api/customers/${customerId}/skus/${skuId}/recalculate`, { method: "POST" });
      await load();
    } finally {
      setRecalculating(null);
    }
  }

  async function openCalcDialog(sku: CustomerSku) {
    setCalcDialogSku(sku);
    setCalcResult(null);
    setCalcLoading(true);
    const res = await fetch(`/api/customers/${customerId}/skus/${sku.id}/calculation`);
    const data = await res.json();
    setCalcResult(data.data);
    setCalcLoading(false);
  }

  return (
    <div className="space-y-4">
      {/* Calculation detail dialog */}
      <Dialog open={calcDialogSku != null} onOpenChange={(open) => { if (!open) setCalcDialogSku(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Calculation — {calcDialogSku?.product.sku} {calcDialogSku?.product.name}
            </DialogTitle>
          </DialogHeader>
          {calcLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : calcResult ? (
            <CalculationPanel calc={calcResult} />
          ) : (
            <div className="text-sm text-gray-500 py-4 text-center">
              No calculation on record. Click &quot;Recalculate&quot; to run the engine.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {canManage && (
        <div className="flex justify-end">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Add Product</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Product to Customer</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label>Product *</Label>
                  <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Selling Price</Label>
                    <Input type="number" step="0.0001" min="0" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Package Qty</Label>
                    <Input type="number" min="1" value={form.packageQuantity} onChange={(e) => setForm({ ...form, packageQuantity: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving || !form.productId}>{saving ? "Saving…" : "Add"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}
      <div className="rounded-md border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Selling Price</TableHead>
              <TableHead>Pkg Qty</TableHead>
              <TableHead>Alert</TableHead>
              <TableHead>Review</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            ) : skus.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-6">No products assigned</TableCell></TableRow>
            ) : (
              skus.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.product.sku}</TableCell>
                  <TableCell>
                    <div className="font-medium">{s.product.name}</div>
                    {s.customerSkuCode && <div className="text-xs text-gray-400">{s.customerSkuCode}</div>}
                  </TableCell>
                  <TableCell>
                    {s.sellingPrice ? `$${parseFloat(s.sellingPrice).toFixed(4)}` : "—"}
                  </TableCell>
                  <TableCell>{s.packageQuantity}</TableCell>
                  <TableCell>
                    <Badge variant={alertVariant(s.alertStatus)}>
                      {s.alertStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{s.reviewStatus.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => openCalcDialog(s)}
                      >
                        View
                      </Button>
                      {canRunCalcs && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={recalculating === s.id}
                          onClick={() => handleRecalculate(s.id)}
                        >
                          {recalculating === s.id ? "…" : "Calc"}
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(s.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;
  const { data: session } = useSession();
  const permissions = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const canManageCustomers = permissions.includes("manage_customers");
  const canManageAllocations = permissions.includes("manage_allocations");
  const canManageMargin = permissions.includes("manage_margin_requirements");
  const canManageSkus = permissions.includes("manage_customer_skus");
  const canRunCalcs = permissions.includes("run_calculations");

  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [paymentTerms, setPaymentTerms] = React.useState<PaymentTerm[]>([]);

  async function loadCustomer() {
    const [custRes, termRes] = await Promise.all([
      fetch(`/api/customers/${customerId}`),
      fetch("/api/payment-terms"),
    ]);
    const custData = await custRes.json();
    const termData = await termRes.json();
    setCustomer(custData.data);
    setPaymentTerms(termData.data ?? []);
    setLoading(false);
  }

  React.useEffect(() => { loadCustomer(); }, [customerId]);

  if (loading) {
    return (
      <div>
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>Customer not found or access denied.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusBadgeVariant = statusVariant(customer.status);

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={`Customer ID: ${customerId}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{customer.code}</Badge>
            <Badge variant={statusBadgeVariant}>
              {customer.status.charAt(0) + customer.status.slice(1).toLowerCase()}
            </Badge>
          </div>
        }
      />
      <div className="p-6">
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="allocations">Allocations</TabsTrigger>
            <TabsTrigger value="margin">Margin Requirements</TabsTrigger>
            <TabsTrigger value="skus">SKUs</TabsTrigger>
          </TabsList>

          {/* Profile */}
          <TabsContent value="profile" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Name</p>
                      <p className="mt-1 font-medium">{customer.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Code</p>
                      <p className="mt-1 font-mono">{customer.code}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                      <Badge variant={statusBadgeVariant} className="mt-1">
                        {customer.status.charAt(0) + customer.status.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Shipping Terms</p>
                      <p className="mt-1">{customer.defaultShippingTerms ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Payment Terms</p>
                      <p className="mt-1">
                        {paymentTerms.find((t) => t.id === customer.paymentTermId)?.name ?? "—"}
                      </p>
                    </div>
                    {customer.creditLimit && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Credit Limit</p>
                        <p className="mt-1">${parseFloat(customer.creditLimit).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
                {customer.notes && (
                  <div className="mt-6 border-t border-gray-100 pt-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm text-gray-700">{customer.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts */}
          <TabsContent value="contacts" className="mt-4">
            <ContactsTab customerId={customerId} canManage={canManageCustomers} />
          </TabsContent>

          {/* Allocations */}
          <TabsContent value="allocations" className="mt-4">
            <AllocationsTab customerId={customerId} canManage={canManageAllocations} />
          </TabsContent>

          {/* Margin Requirements */}
          <TabsContent value="margin" className="mt-4">
            <MarginRequirementsTab customerId={customerId} canManage={canManageMargin} />
          </TabsContent>

          {/* SKUs */}
          <TabsContent value="skus" className="mt-4">
            <SkusTab customerId={customerId} canManage={canManageSkus} canRunCalcs={canRunCalcs} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
