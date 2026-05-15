import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { getParticipantsPage } from "@/services/participants";
import { getWorkspaceContext } from "@/services/workspaces";
import type { ParticipantStatus } from "@/lib/api/types";

import { ParticipantsClient } from "./participants-client";

type ParticipantsPageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{
    search?: string;
    groupId?: string;
    status?: string;
    page?: string;
  }>;
};

const VALID_STATUSES: ParticipantStatus[] = ["active", "inactive", "deleted"];

export default async function ParticipantsPage({
  params,
  searchParams,
}: ParticipantsPageProps) {
  const { workspaceId } = await params;
  const sp = await searchParams;

  const status =
    sp.status && (VALID_STATUSES as string[]).includes(sp.status)
      ? (sp.status as ParticipantStatus)
      : undefined;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [contextResult, participantsResult] = await Promise.all([
    getWorkspaceContext(workspaceId),
    getParticipantsPage({
      workspaceId,
      search: sp.search,
      groupId: sp.groupId,
      status,
      page,
    }),
  ]);

  if (!contextResult.ok || !participantsResult.ok) {
    const err = !contextResult.ok
      ? contextResult.error
      : participantsResult.ok
        ? null
        : participantsResult.error;
    if (err?.code === "WORKSPACE_ACCESS_DENIED") {
      redirect("/workspaces");
    }
    return (
      <EmptyState
        title="참여자 목록을 불러오지 못했습니다"
        description={err?.message ?? "잠시 후 다시 시도해 주세요."}
      />
    );
  }

  const role = contextResult.data.workspace.currentMember.role;
  const canCreate = role === "owner_admin" || role === "group_admin";
  const canDelete = role === "owner_admin";

  return (
    <ParticipantsClient
      workspaceId={workspaceId}
      initialFilters={{
        search: sp.search ?? "",
        groupId: sp.groupId ?? "",
        status: sp.status ?? "",
      }}
      data={participantsResult.data}
      accessibleGroups={contextResult.data.accessibleGroups}
      canCreate={canCreate}
      canDelete={canDelete}
      isGroupAdmin={role === "group_admin"}
    />
  );
}
