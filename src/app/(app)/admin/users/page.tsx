import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminUsersPage() {
  return (
    <div>
      <PageHeader title="User Administration" description="Manage users, roles, and customer assignments" />
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">User management UI coming in Phase 1 completion.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
