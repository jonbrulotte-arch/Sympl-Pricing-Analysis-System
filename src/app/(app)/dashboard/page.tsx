import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Your pricing analysis overview" />
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Dashboard coming in Phase 5.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
