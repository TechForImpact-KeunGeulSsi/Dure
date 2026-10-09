import { redirect } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getWorkspaceContext } from "@/services/workspaces";

type DashboardLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
};

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { workspaceId } = await params;
  const result = await getWorkspaceContext(workspaceId);

  if (!result.ok) {
    redirect("/workspaces");
  }

  const { workspace, capabilities } = result.data;

  return (
    <div className="flex min-h-screen print:block print:min-h-0">
      <Sidebar workspace={workspace} capabilities={capabilities} />
      <div className="flex min-w-0 flex-1 flex-col print:block">
        <Header member={workspace.currentMember} workspaceId={workspace.id} />
        <main className="flex-1 overflow-y-auto bg-[var(--color-muted)] p-6 print:overflow-visible print:bg-white print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
