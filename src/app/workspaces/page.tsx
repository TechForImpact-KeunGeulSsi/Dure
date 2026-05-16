import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { listMyWorkspaces } from "@/services/workspaces";
import { workspaceRoleLabel } from "@/lib/api/labels";

export default async function WorkspacesPage() {
  await requireUser();
  const workspaces = await listMyWorkspaces();

  if (workspaces.length === 0) {
    redirect("/workspaces/new");
  }

  if (workspaces.length === 1) {
    redirect(`/workspaces/${workspaces[0].id}/home`);
  }

  return (
    <main className="min-h-screen bg-[var(--color-muted)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
            워크스페이스 선택
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            계속할 워크스페이스를 선택해 주세요.
          </p>
        </header>
        <ul className="space-y-3">
          {workspaces.map((ws) => (
            <li key={ws.id}>
              <Link
                href={`/workspaces/${ws.id}/home`}
                className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4 hover:border-[var(--color-primary)]"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-[var(--color-foreground)]">
                    {ws.name}
                  </span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {workspaceRoleLabel(ws.role)} · {ws.timezone}
                  </span>
                </span>
                <span className="text-sm text-[var(--color-primary)]">진입 →</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <Link
            href="/workspaces/discover"
            className="text-[var(--color-primary)] underline"
          >
            다른 워크스페이스 둘러보기
          </Link>
          <span className="text-[var(--color-muted-foreground)]">·</span>
          <Link
            href="/workspaces/new"
            className="text-[var(--color-primary)] underline"
          >
            새 워크스페이스 만들기
          </Link>
        </div>
      </div>
    </main>
  );
}
