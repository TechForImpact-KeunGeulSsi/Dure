"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Plus } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { workspaceRoleLabel } from "@/lib/api/labels";
import type { MemberSummary, UUID } from "@/lib/api/types";

type HeaderProps = {
  member: MemberSummary;
  workspaceId: UUID;
};

export function Header({ member, workspaceId }: HeaderProps) {
  const canCreateCourse =
    member.role === "owner_admin" || member.role === "group_admin";
  const router = useRouter();
  const [showActivity, setShowActivity] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const initials = (member.displayName ?? member.email)
    .trim()
    .slice(0, 1)
    .toUpperCase();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)] px-4">
      {canCreateCourse && (
        <Link
          href={`/workspaces/${workspaceId}/manage/courses/new`}
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">수업 만들기</span>
        </Link>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowActivity((v) => !v);
            setShowUserMenu(false);
          }}
          className={cn(
            "flex size-9 items-center justify-center rounded-full hover:bg-[var(--color-muted)]",
            showActivity && "bg-[var(--color-muted)]",
          )}
          aria-label="최근 활동"
        >
          <Bell className="size-4 text-[var(--color-foreground)]" />
        </button>
        {showActivity && (
          <div className="absolute right-0 top-12 z-20 w-80 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-md">
            <div className="px-4 py-3 border-b border-[var(--color-border)] text-sm font-medium text-[var(--color-foreground)]">
              최근 활동
            </div>
            <div className="px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              표시할 최근 활동이 없습니다.
            </div>
          </div>
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
