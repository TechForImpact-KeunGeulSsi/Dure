"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  LayoutGrid,
  MessageSquare,
  Receipt,
  UserCog,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import type { WorkspaceCapabilities, WorkspaceSummary } from "@/lib/api/types";

type SidebarProps = {
  workspace: WorkspaceSummary;
  capabilities: WorkspaceCapabilities;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  visible: boolean;
  match: (pathname: string) => boolean;
};

export function Sidebar({ workspace, capabilities }: SidebarProps) {
  const pathname = usePathname();
  const base = `/workspaces/${workspace.id}`;

  const items: NavItem[] = [
    {
      href: `${base}/home`,
      label: "홈",
      icon: Home,
      visible: true,
      match: (p) => p === `${base}/home` || p === base,
    },
    {
      href: `${base}/calendar`,
      label: "일정 관리",
      icon: CalendarDays,
      visible: capabilities.canViewGeneralSchedule,
      match: (p) => p.startsWith(`${base}/calendar`),
    },
    {
      href: `${base}/members`,
      label: "강사·운영자 관리",
      icon: UserCog,
      visible: capabilities.canManageMembers,
      match: (p) => p.startsWith(`${base}/members`),
    },
    {
      href: `${base}/manage/groups`,
      label: "참여자·수업 관리",
      icon: LayoutGrid,
      visible: workspace.currentMember.role !== "instructor",
      match: (p) => p.startsWith(`${base}/manage`),
    },
    {
      href: `${base}/settlements`,
      label: "정산 요청",
      icon: Receipt,
      visible: workspace.currentMember.role !== "instructor",
      match: (p) => p.startsWith(`${base}/settlements`),
    },
    {
      href: `${base}/feedback`,
      label: "의견 수렴",
      icon: MessageSquare,
      visible: workspace.currentMember.role !== "instructor",
      match: (p) => p.startsWith(`${base}/feedback`),
    },
  ];

  return (
    <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-muted-foreground)]">워크스페이스</p>
        <p className="mt-1 text-base font-semibold text-[var(--color-foreground)] truncate">
          {workspace.name}
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items
          .filter((item) => item.visible)
          .map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm",
                  active
                    ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
