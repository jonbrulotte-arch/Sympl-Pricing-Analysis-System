"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Role = { id: string; name: string; description: string | null };
type Assignment = { customerId: string; role: string; customer: { id: string; name: string; code: string } };
type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: string; name: string } | null;
};
type UserDetail = User & { assignments: Assignment[] };
type Customer = { id: string; name: string; code: string };

const ASSIGNMENT_ROLES = ["OWNER", "MANAGER", "ANALYST", "VIEWER"] as const;

function fmtDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString();
}

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Create user dialog
  const [showCreate, setShowCreate] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({ email: "", firstName: "", lastName: "", password: "", roleId: "" });
  const [createError, setCreateError] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Edit user dialog
  const [editUser, setEditUser] = React.useState<UserDetail | null>(null);
  const [editForm, setEditForm] = React.useState({ firstName: "", lastName: "", roleId: "" });
  const [editError, setEditError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Customer assignment within edit dialog
  const [assignCustomerId, setAssignCustomerId] = React.useState("");
  const [assignRole, setAssignRole] = React.useState<string>("ANALYST");
  const [assigning, setAssigning] = React.useState(false);

  async function load() {
    setLoading(true);
    const [uRes, rRes, cRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/roles"),
      fetch("/api/customers"),
    ]);
    const [uData, rData, cData] = await Promise.all([uRes.json(), rRes.json(), cRes.json()]);
    setUsers(uData.data ?? []);
    setRoles(rData.data ?? []);
    setCustomers(cData.data ?? []);
    setLoading(false);
  }

  React.useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const d = await res.json();
    if (res.ok) {
      setShowCreate(false);
      setCreateForm({ email: "", firstName: "", lastName: "", password: "", roleId: "" });
      await load();
    } else {
      setCreateError(d.error ?? "Failed to create user");
    }
    setCreating(false);
  }

  async function openEdit(user: User) {
    const res = await fetch(`/api/users/${user.id}`);
    const d = await res.json();
    const detail: UserDetail = d.data;
    setEditUser(detail);
    setEditForm({ firstName: detail.firstName, lastName: detail.lastName, roleId: detail.role?.id ?? "" });
    setEditError("");
    setAssignCustomerId("");
    setAssignRole("ANALYST");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    setEditError("");
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const d = await res.json();
    if (res.ok) {
      setEditUser(null);
      await load();
    } else {
      setEditError(d.error ?? "Failed to save");
    }
    setSaving(false);
  }

  async function handleToggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    await load();
  }

  async function handleAddAssignment() {
    if (!editUser || !assignCustomerId) return;
    setAssigning(true);
    const res = await fetch(`/api/users/${editUser.id}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: assignCustomerId, role: assignRole }),
    });
    if (res.ok) {
      const detailRes = await fetch(`/api/users/${editUser.id}`);
      const d = await detailRes.json();
      setEditUser(d.data);
      setAssignCustomerId("");
    }
    setAssigning(false);
  }

  async function handleRemoveAssignment(customerId: string) {
    if (!editUser) return;
    await fetch(`/api/users/${editUser.id}/assignments/${customerId}`, { method: "DELETE" });
    const detailRes = await fetch(`/api/users/${editUser.id}`);
    const d = await detailRes.json();
    setEditUser(d.data);
  }

  const unassignedCustomers = customers.filter(
    (c) => !editUser?.assignments.some((a) => a.customerId === c.id)
  );

  return (
    <div>
      <PageHeader title="User Administration" description="Manage users, roles, and customer assignments" />
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowCreate(true)}>Add User</Button>
        </div>

        <div className="rounded-md border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">No users found</TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} className={u.isActive ? "" : "opacity-50"}>
                    <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                    <TableCell className="text-gray-600 text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{u.role?.name ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "default" : "destructive"} className="text-xs">
                        {u.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{fmtDate(u.lastLoginAt)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={u.isActive ? "text-red-600" : "text-green-600"}
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={createForm.firstName} onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={createForm.lastName} onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Temporary Password</Label>
              <Input type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={createForm.roleId} onValueChange={(v) => setCreateForm((f) => ({ ...f, roleId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role…" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !createForm.roleId}>
                {creating ? "Creating…" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User — {editUser?.firstName} {editUser?.lastName}</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-5 py-2">
              {/* Basic info */}
              <form onSubmit={handleSaveEdit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name</Label>
                    <Input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={editForm.roleId} onValueChange={(v) => setEditForm((f) => ({ ...f, roleId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role…" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {editError && <p className="text-sm text-red-600">{editError}</p>}
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
                </div>
              </form>

              {/* Customer Assignments */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">Customer Assignments</h4>
                <div className="space-y-1.5">
                  {editUser.assignments.length === 0 ? (
                    <p className="text-sm text-gray-400">No customer assignments</p>
                  ) : (
                    editUser.assignments.map((a) => (
                      <div key={a.customerId} className="flex items-center justify-between text-sm">
                        <span>{a.customer.name} <span className="text-gray-400">({a.customer.code})</span></span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{a.role}</Badge>
                          <Button variant="ghost" size="sm" className="text-red-500 h-6 px-2 text-xs" onClick={() => handleRemoveAssignment(a.customerId)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {unassignedCustomers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Select value={assignCustomerId} onValueChange={setAssignCustomerId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Add customer…" />
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedCustomers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={assignRole} onValueChange={setAssignRole}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNMENT_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" disabled={!assignCustomerId || assigning} onClick={handleAddAssignment}>
                      Add
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
