import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function AuditLogPage() {
  return (
    <div>
      <PageHeader title="Audit Log" description="Immutable record of all sensitive actions" />
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Audit log viewer coming in Phase 1 completion.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
