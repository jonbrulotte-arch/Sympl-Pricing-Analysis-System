"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ConfigEntry = {
  key: string;
  value: string | null;
  isEncrypted: boolean;
  description: string | null;
  updatedAt: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export default function AdminSettingsPage() {
  const [configs, setConfigs] = React.useState<ConfigEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Edit dialog
  const [editEntry, setEditEntry] = React.useState<ConfigEntry | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [editEncrypted, setEditEncrypted] = React.useState(false);
  const [editDesc, setEditDesc] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [editError, setEditError] = React.useState("");

  // New key dialog
  const [showNew, setShowNew] = React.useState(false);
  const [newKey, setNewKey] = React.useState("");
  const [newValue, setNewValue] = React.useState("");
  const [newEncrypted, setNewEncrypted] = React.useState(false);
  const [newDesc, setNewDesc] = React.useState("");
  const [newError, setNewError] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  async function loadConfigs() {
    setLoading(true);
    const res = await fetch("/api/admin/config");
    const d = await res.json();
    setConfigs(d.data ?? []);
    setLoading(false);
  }

  React.useEffect(() => { loadConfigs(); }, []);

  function openEdit(entry: ConfigEntry) {
    setEditEntry(entry);
    setEditValue(entry.value ?? "");
    setEditEncrypted(entry.isEncrypted);
    setEditDesc(entry.description ?? "");
    setEditError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editEntry) return;
    setSaving(true);
    setEditError("");
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: editEntry.key,
        value: editValue,
        isEncrypted: editEncrypted,
        description: editDesc || undefined,
      }),
    });
    const d = await res.json();
    if (res.ok) {
      setEditEntry(null);
      await loadConfigs();
    } else {
      setEditError(d.error ?? "Failed to save");
    }
    setSaving(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setNewError("");
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: newKey.trim(),
        value: newValue,
        isEncrypted: newEncrypted,
        description: newDesc || undefined,
      }),
    });
    const d = await res.json();
    if (res.ok) {
      setShowNew(false);
      setNewKey(""); setNewValue(""); setNewEncrypted(false); setNewDesc("");
      await loadConfigs();
    } else {
      setNewError(d.error ?? "Failed to create");
    }
    setCreating(false);
  }

  const marginKeys = configs.filter((c) => c.key.startsWith("margin."));
  const otherKeys = configs.filter((c) => !c.key.startsWith("margin."));

  return (
    <div>
      <PageHeader title="System Settings" description="Application configuration and margin thresholds" />
      <div className="p-6">
        <Tabs defaultValue="general">
          <TabsList className="mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="margins">Margin Thresholds</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="rounded-md border border-gray-200 bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-medium text-gray-700">Configuration Keys</span>
                <Button size="sm" onClick={() => setShowNew(true)}>Add Key</Button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Key</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Value</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Description</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Updated</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 5 }).map((__, j) => (
                          <td key={j} className="px-4 py-2"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  ) : otherKeys.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No configuration keys</td>
                    </tr>
                  ) : (
                    otherKeys.map((entry) => (
                      <tr key={entry.key} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-xs text-gray-800">{entry.key}</td>
                        <td className="px-4 py-2">
                          {entry.isEncrypted ? (
                            <Badge variant="secondary" className="text-xs">Encrypted</Badge>
                          ) : (
                            <span className="font-mono text-xs text-gray-700">{entry.value ?? <span className="text-gray-400 italic">empty</span>}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{entry.description ?? "—"}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{fmtDate(entry.updatedAt)}</td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(entry)}>Edit</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="margins">
            <div className="rounded-md border border-gray-200 bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-medium text-gray-700">Margin Threshold Configuration</span>
                <Button size="sm" onClick={() => { setNewKey("margin."); setShowNew(true); }}>Add Threshold</Button>
              </div>
              {loading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : marginKeys.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  No margin thresholds configured. Add keys prefixed with <span className="font-mono">margin.</span>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Threshold Key</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Value (%)</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Description</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {marginKeys.map((entry) => (
                      <tr key={entry.key} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-xs text-gray-800">{entry.key}</td>
                        <td className="px-4 py-2 font-medium">{entry.value ?? "—"}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{entry.description ?? "—"}</td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(entry)}>Edit</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onOpenChange={(open) => { if (!open) setEditEntry(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Config — <span className="font-mono text-sm">{editEntry?.key}</span></DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input
                type={editEncrypted ? "password" : "text"}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={editEntry?.isEncrypted ? "Enter new value to update…" : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="enc-toggle"
                checked={editEncrypted}
                onCheckedChange={setEditEncrypted}
              />
              <Label htmlFor="enc-toggle" className="cursor-pointer">Store encrypted</Label>
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Key Dialog */}
      <Dialog open={showNew} onOpenChange={(open) => { if (!open) { setShowNew(false); setNewKey(""); setNewValue(""); setNewEncrypted(false); setNewDesc(""); setNewError(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Configuration Key</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Key</Label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. margin.minimum.default"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input
                type={newEncrypted ? "password" : "text"}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="new-enc-toggle"
                checked={newEncrypted}
                onCheckedChange={setNewEncrypted}
              />
              <Label htmlFor="new-enc-toggle" className="cursor-pointer">Store encrypted</Label>
            </div>
            {newError && <p className="text-sm text-red-600">{newError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !newKey.trim()}>{creating ? "Creating…" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
