"use client";

import { usePathname } from "next/navigation";

import { Tabs, type TabItem } from "@/components/ui/tabs";

type ManageTabsProps = {
  workspaceId: string;
};

export function ManageTabs({ workspaceId }: ManageTabsProps) {
  const pathname = usePathname();
  const base = `/workspaces/${workspaceId}/manage`;

  const items: TabItem[] = [
    {
      href: `${base}/groups`,
      label: "그룹 관리",
      active: pathname.startsWith(`${base}/groups`),
    },
    {
      href: `${base}/courses`,
      label: "수업 관리",
      active: pathname.startsWith(`${base}/courses`),
    },
    {
      href: `${base}/participants`,
      label: "참여자 관리",
      active: pathname.startsWith(`${base}/participants`),
    },
  ];

  return <Tabs items={items} />;
}
