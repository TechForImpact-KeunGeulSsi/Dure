import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { getGroupsPage } from "@/services/groups";
import { getWorkspaceContext } from "@/services/workspaces";
import type { GroupStatus } from "@/lib/api/types";

import { GroupsClient } from "./groups-client";

type GroupsPageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
};

const VALID_STATUSES: GroupStatus[] = ["active", "inactive"];

export default async function GroupsPage({
  params,
  searchParams,
}: GroupsPageProps) {
  const { workspaceId } = await params;
  const sp = await searchParams;

  const status =
    sp.status && (VALID_STATUSES as string[]).includes(sp.status)
      ? (sp.status as GroupStatus)
      : undefined;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [contextResult, groupsResult] = await Promise.all([
    getWorkspaceContext(workspaceId),
    getGroupsPage({
      workspaceId,
      search: sp.search,
      status,
      page,
    }),
  ]);

  if (!contextResult.ok || !groupsResult.ok) {
    const err = !contextResult.ok ? contextResult.error : groupsResult.ok
      ? null
      : groupsResult.error;
    if (err?.code === "WORKSPACE_ACCESS_DENIED") {
      redirect("/workspaces");
    }
    return (
      <EmptyState
        title="그룹 목록을 불러오지 못했습니다"
        description={err?.message ?? "잠시 후 다시 시도해 주세요."}
      />
    );
  }

  const canCreate =
    contextResult.data.workspace.currentMember.role === "owner_admin";

  return (
    <GroupsClient
      workspaceId={workspaceId}
      initialFilters={{ search: sp.search ?? "", status: sp.status ?? "" }}
      data={groupsResult.data}
      canCreate={canCreate}
    />
  );
}
