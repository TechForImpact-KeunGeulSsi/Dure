import Link from "next/link";

import { listDiscoverableWorkspaces } from "@/services/join-requests";

import { DiscoverClient } from "./discover-client";

type SearchParams = Promise<{ q?: string; page?: string }>;

export default async function DiscoverWorkspacesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, page: pageParam } = await searchParams;
  const search = (q ?? "").trim();
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const result = await listDiscoverableWorkspaces({ search, page });

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-[var(--color-muted)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-2 text-center">
          <h1 className="text-lg font-semibold text-[var(--color-foreground)]">
            워크스페이스 목록을 불러오지 못했습니다
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {result.error.message}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-muted)] px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
            워크스페이스 둘러보기
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            참여하고 싶은 워크스페이스에 요청을 보내세요. 대표 운영자가 수락하면 즉시
            활성화됩니다.
          </p>
        </header>

        <DiscoverClient
          initialSearch={search}
          page={page}
          data={result.data}
        />

        <div className="text-center">
          <Link
            href="/workspaces"
            className="text-sm text-[var(--color-primary)] underline"
          >
            ← 내 워크스페이스로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
