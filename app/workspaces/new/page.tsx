import { requireUser } from "@/lib/auth/require-user";

import { NewWorkspaceForm } from "./new-workspace-form";

export default async function NewWorkspacePage() {
  await requireUser();

  return (
    <main className="min-h-screen bg-[var(--color-muted)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-sm border border-[var(--color-border)] p-8">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-[var(--color-foreground)]">
            새 워크스페이스 만들기
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            워크스페이스를 만들면 자동으로 대표 운영자로 등록됩니다.
          </p>
        </header>
        <NewWorkspaceForm />
      </div>
    </main>
  );
}
