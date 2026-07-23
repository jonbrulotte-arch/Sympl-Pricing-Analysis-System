import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await auth();
  return (
    <div>
      <PageHeader title="My Profile" description="Account settings and preferences" />
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Name:</span> {session?.user.name}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Email:</span> {session?.user.email}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Role:</span>{" "}
              {session?.user.role?.replace(/_/g, " ")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
