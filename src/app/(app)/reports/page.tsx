import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="Scheduled and on-demand reports" />
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Reports coming in Phase 7.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
