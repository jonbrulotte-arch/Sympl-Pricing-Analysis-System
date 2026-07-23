import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminSettingsPage() {
  return (
    <div>
      <PageHeader title="System Settings" description="Application configuration" />
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">System settings coming in Phase 8.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
