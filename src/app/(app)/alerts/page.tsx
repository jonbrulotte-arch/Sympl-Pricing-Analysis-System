import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function AlertsPage() {
  return (
    <div>
      <PageHeader title="Alerts" description="Profitability and data quality alerts" />
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Alert management coming in Phase 5.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
