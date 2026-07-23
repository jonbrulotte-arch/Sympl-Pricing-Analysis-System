import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function CustomersPage() {
  return (
    <div>
      <PageHeader title="Customers" description="Your assigned customer accounts" />
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Customer list coming in Phase 2.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
