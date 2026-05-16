"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { workspaceRoleLabel } from "@/lib/api/labels";
import { cancelMyJoinRequest } from "@/services/join-requests";
import type {
  DiscoverableWorkspaceItem,
  ListDiscoverableOutput,
} from "@/services/join-requests";

import { RequestAccessDialog } from "./request-access-dialog";

type Props = {
  initialSearch: string;
  page: number;
  data: ListDiscoverableOutput;
};

export function DiscoverClient({ initialSearch, page, data }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [requestTarget, setRequestTarget] =
    useState<DiscoverableWorkspaceItem | null>(null);
  const [pendingCancel, startCancel] = useTransition();
  const initialMountRef = useRef(true);

  // URL ?q= 디바운스 동기화
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const trimmed = search.trim();
      if (trimmed.length > 0) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      params.delete("page"); // 검색어 바뀌면 1페이지로
      const queryString = params.toString();
      router.replace(
        `/workspaces/discover${queryString ? `?${queryString}` : ""}`,
      );
    }, 300);
    return () => clearTimeout(handle);
    // search만 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totalPages = Math.max(
    1,
    Math.ceil(data.pageInfo.totalCount / data.pageInfo.pageSize),
  );

  function buildHref(targetPage: number): string {
    const params = new URLSearchParams();
    const trimmed = search.trim();
    if (trimmed.length > 0) params.set("q", trimmed);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/workspaces/discover${qs ? `?${qs}` : ""}`;
  }

  async function handleCancel(requestId: string, workspaceName: string) {
    startCancel(async () => {
      const result = await cancelMyJoinRequest(requestId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`${workspaceName} 참여 요청을 취소했습니다.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="워크스페이스 이름으로 검색"
          aria-label="워크스페이스 검색"
          className="pl-9"
        />
      </div>

      {data.workspaces.length === 0 ? (
        <EmptyState search={initialSearch} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.workspaces.map((ws) => (
            <li
              key={ws.workspaceId}
              className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-5"
            >
              <div className="space-y-1">
                <p className="text-base font-semibold text-[var(--color-foreground)]">
                  {ws.name}
                </p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {ws.timezone} · 활성 멤버 {ws.memberCount}명
                </p>
              </div>
              <div className="mt-auto">
                <WorkspaceCta
                  workspace={ws}
                  onRequest={() => setRequestTarget(ws)}
                  onCancel={(reqId) => handleCancel(reqId, ws.name)}
                  pendingCancel={pendingCancel}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={buildHref}
      />

      <RequestAccessDialog
        workspace={requestTarget}
        open={requestTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRequestTarget(null);
        }}
      />
    </div>
  );
}

function WorkspaceCta({
  workspace,
  onRequest,
  onCancel,
  pendingCancel,
}: {
  workspace: DiscoverableWorkspaceItem;
  onRequest: () => void;
  onCancel: (requestId: string) => void;
  pendingCancel: boolean;
}) {
  if (workspace.myMembershipStatus === "active") {
    return (
      <Link
        href={`/workspaces/${workspace.workspaceId}/home`}
        className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
      >
        입장 →
      </Link>
    );
  }
  if (workspace.myMembershipStatus === "invited") {
    return (
      <span className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-3 text-xs text-[var(--color-muted-foreground)]">
        초대 받음 — 메일에서 수락
      </span>
    );
  }
  if (workspace.myPendingRequest) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center rounded-full bg-amber-100 px-3 text-xs font-medium text-amber-800">
          {workspaceRoleLabel(workspace.myPendingRequest.desiredRole)} · 요청 대기 중
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={pendingCancel}
          onClick={() => onCancel(workspace.myPendingRequest!.id)}
        >
          취소
        </Button>
      </div>
    );
  }
  return (
    <Button onClick={onRequest}>참여 요청</Button>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] py-10 text-center">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {search
          ? `"${search}" 검색 결과가 없습니다.`
          : "공개된 워크스페이스가 없습니다."}
      </p>
      <Link
        href="/workspaces/new"
        className="text-sm font-medium text-[var(--color-primary)] underline"
      >
        새 워크스페이스 만들기
      </Link>
    </div>
  );
}
