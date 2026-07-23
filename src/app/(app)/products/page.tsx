import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function ProductsPage() {
  return (
    <div>
      <PageHeader title="Products" description="Product catalog and dimensions" />
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Product management coming in Phase 2.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
