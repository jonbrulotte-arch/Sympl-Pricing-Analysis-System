import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function ImportsPage() {
  return (
    <div>
      <PageHeader title="Imports & Exports" description="Data import and export workflows" />
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Import/export tools coming in Phase 2.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
