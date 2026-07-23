import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function NotificationsPage() {
  return (
    <div>
      <PageHeader title="Notifications" description="Mentions, alerts, and system notifications" />
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Notifications coming in Phase 6.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
