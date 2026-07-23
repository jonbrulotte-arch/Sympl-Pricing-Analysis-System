import { Sidebar } from "./sidebar";

interface AppShellProps {
  children: React.ReactNode;
  userPermissions: string[];
  userName: string;
  userRole: string;
}

export function AppShell({ children, userPermissions, userName, userRole }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar userPermissions={userPermissions} userName={userName} userRole={userRole} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
