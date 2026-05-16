"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { workspaceRoleLabel } from "@/lib/api/labels";
import { getRecentActivity } from "@/services/activity";
import type { ActivityItem, MemberSummary, UUID } from "@/lib/api/types";

type HeaderProps = {
  member: MemberSummary;
  workspaceId: UUID;
};

type ActivityState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; items: ActivityItem[] }
  | { kind: "error"; message: string };

/**
 * localStorage 키 — 워크스페이스별로 마지막으로 알림을 확인한 timestamp.
 * 이 값 이후의 activity가 있으면 종 아이콘에 빨간 점이 표시된다.
 */
function lastSeenStorageKey(workspaceId: UUID): string {
  return `dure:activity-last-seen:${workspaceId}`;
}

function readLastSeen(workspaceId: UUID): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(lastSeenStorageKey(workspaceId));
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeLastSeen(workspaceId: UUID, timestampMs: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    lastSeenStorageKey(workspaceId),
    String(timestampMs),
  );
}

export function Header({ member, workspaceId }: HeaderProps) {
  const router = useRouter();
  const [showActivity, setShowActivity] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activityState, setActivityState] = useState<ActivityState>({
    kind: "idle",
  });
  const [lastSeenMs, setLastSeenMs] = useState<number>(0);
  const initials = (member.displayName ?? member.email)
    .trim()
    .slice(0, 1)
    .toUpperCase();

  const loadActivities = useCallback(async () => {
    setActivityState({ kind: "loading" });
    const result = await getRecentActivity({ workspaceId, limit: 20 });
    if (result.ok) {
      setActivityState({ kind: "loaded", items: result.data.activities });
    } else {
      setActivityState({ kind: "error", message: result.error.message });
    }
  }, [workspaceId]);

  // 마운트 시 1회 fetch — 빨간 점 표시를 위해 드롭다운을 열기 전부터 데이터 필요.
  useEffect(() => {
    setLastSeenMs(readLastSeen(workspaceId));
    void loadActivities();
  }, [workspaceId, loadActivities]);

  const latestActivityMs = useMemo(() => {
    if (activityState.kind !== "loaded") return 0;
    let max = 0;
    for (const item of activityState.items) {
      const t = new Date(item.createdAt).getTime();
      if (Number.isFinite(t) && t > max) max = t;
    }
    return max;
  }, [activityState]);

  const hasUnread = latestActivityMs > lastSeenMs;

  function handleBellClick() {
    const opening = !showActivity;
    setShowActivity(opening);
    setShowUserMenu(false);
    if (opening && latestActivityMs > 0) {
      writeLastSeen(workspaceId, latestActivityMs);
      setLastSeenMs(latestActivityMs);
    }
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)] px-4">
      <div className="relative">
        <button
          type="button"
          onClick={handleBellClick}
          className={cn(
            "relative flex size-9 items-center justify-center rounded-full hover:bg-[var(--color-muted)]",
            showActivity && "bg-[var(--color-muted)]",
          )}
          aria-label={hasUnread ? "최근 활동 (새 알림)" : "최근 활동"}
        >
          <Bell className="size-4 text-[var(--color-foreground)]" />
          {hasUnread && (
            <span
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-[var(--color-card)]"
              aria-hidden
            />
          )}
        </button>
        {showActivity && (
          <ActivityDropdown
            state={activityState}
            onItemClick={() => setShowActivity(false)}
            onRetry={loadActivities}
          />
        )}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowUserMenu((v) => !v);
            setShowActivity(false);
          }}
          className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-[var(--color-muted)]"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-[var(--color-primary-foreground)]">
            {initials}
          </span>
          <span className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-sm text-[var(--color-foreground)]">
              {member.displayName ?? member.email}
            </span>
            <span className="text-[10px] text-[var(--color-muted-foreground)]">
              {workspaceRoleLabel(member.role)}
            </span>
          </span>
        </button>
        {showUserMenu && (
          <div className="absolute right-0 top-12 z-20 w-56 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-md">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                {member.displayName ?? member.email}
              </p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {workspaceRoleLabel(member.role)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
            >
              <LogOut className="size-4" />
              로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function ActivityDropdown({
  state,
  onItemClick,
  onRetry,
}: {
  state: ActivityState;
  onItemClick: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="absolute right-0 top-12 z-20 max-h-[28rem] w-96 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-md">
      <div className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-foreground)]">
        최근 활동
      </div>
      <div className="max-h-[24rem] overflow-y-auto">
        {state.kind === "loading" && (
          <p className="px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
            불러오는 중…
          </p>
        )}
        {state.kind === "error" && (
          <div className="px-4 py-8 text-center text-sm">
            <p className="text-rose-600">{state.message}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 text-xs text-[var(--color-primary)] underline"
            >
              다시 시도
            </button>
          </div>
        )}
        {state.kind === "loaded" && state.items.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
            표시할 최근 활동이 없습니다.
          </p>
        )}
        {state.kind === "loaded" && state.items.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)]">
            {state.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.target.href}
                  onClick={onItemClick}
                  className="block px-4 py-3 hover:bg-[var(--color-muted)]"
                >
                  <div className="flex items-start gap-3">
                    <ActorAvatar actor={item.actor} title={item.title} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--color-foreground)]">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">
                          {item.description}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ActorAvatar({
  actor,
  title,
}: {
  actor: MemberSummary | null;
  title: string;
}) {
  // actor가 null인 경우(예: join_requested) title 첫 글자를 fallback으로 사용
  const sourceText = actor?.displayName?.trim() || actor?.email?.trim() || title;
  const label = sourceText.trim()[0] ?? "·";
  return (
    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-semibold text-[var(--color-primary)]">
      {label.toUpperCase()}
    </span>
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}
