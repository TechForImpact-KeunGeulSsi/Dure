"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  GroupSummary,
  PageInfo,
  ParticipantListItem,
  ParticipantStatus,
  UUID,
} from "@/lib/api/types";
import {
  UpdateParticipantGroupsSchema,
  UpsertParticipantSchema,
  type UpdateParticipantGroupsInput,
  type UpsertParticipantInput,
} from "@/lib/validators/participant";

// ─────────────────────────────────────────────────────────────
// participants / participant_groups의 INSERT/UPDATE/DELETE는
// `materials`와 동일한 RLS 패턴(created_by = current_member_id) 때문에
// SSR에서 통과되지 않는 케이스가 있어 admin client로 우회한다.
// 권한 검증은 service 레이어에서 수행: 워크스페이스 멤버십, owner/group_admin
// 분기, 접근 그룹 교차 검사.
// SELECT는 server client(RLS 적용) 유지.
// ─────────────────────────────────────────────────────────────

type GetParticipantsPageInput = {
  workspaceId: UUID;
  search?: string;
  groupId?: UUID;
  status?: ParticipantStatus;
  page?: number;
  pageSize?: number;
};

export type GetParticipantsPageOutput = {
  participants: ParticipantListItem[];
  pageInfo: PageInfo;
};

const DEFAULT_PAGE_SIZE = 20;

export async function getParticipantsPage(
  input: GetParticipantsPageInput,
): Promise<ApiResult<GetParticipantsPageOutput>> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  await requireUser();
  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const supabase = await createSupabaseServerClient();
  const accessibleGroupIds = await loadAccessibleGroupIds(input.workspaceId);

  let candidateIds: UUID[] | null = null;
  if (input.groupId) {
    const { data: pgRows, error: pgError } = await supabase
      .from("participant_groups")
      .select("participant_id")
      .eq("workspace_id", input.workspaceId)
      .eq("status", "active")
      .eq("group_id", input.groupId);
    if (pgError) return apiError("INTERNAL_ERROR", pgError.message);
    candidateIds = Array.from(
      new Set((pgRows ?? []).map((row) => row.participant_id as UUID)),
    );
    if (candidateIds.length === 0) {
      return apiOk({
        participants: [],
        pageInfo: { page, pageSize, totalCount: 0, hasNextPage: false },
      });
    }
  }

  let query = supabase
    .from("participants")
    .select("id, name, memo, status, created_by, created_at, updated_at", {
      count: "exact",
    })
    .eq("workspace_id", input.workspaceId)
    .order("name", { ascending: true })
    .range(from, to);

  if (input.search && input.search.trim().length > 0) {
    query = query.ilike("name", `%${input.search.trim()}%`);
  }
  if (input.status) {
    query = query.eq("status", input.status);
  } else {
    query = query.in("status", ["active", "inactive"]);
  }
  if (candidateIds) {
    query = query.in("id", candidateIds);
  }

  const { data, error, count } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const rows = data ?? [];
  const participantIds = rows.map((row) => row.id as UUID);

  const [groupsByParticipant, courseCountsByParticipant] = await Promise.all([
    loadGroupsByParticipant(participantIds),
    loadCourseCountsByParticipant(participantIds),
  ]);

  const isOwner = membership.role === "owner_admin";

  const participants: ParticipantListItem[] = rows.map((row) => {
    const groups = groupsByParticipant.get(row.id) ?? [];
    const groupIds = new Set(groups.map((group) => group.id));
    const inOnlyAccessibleGroups =
      groups.length > 0 &&
      [...groupIds].every((gid) => accessibleGroupIds.has(gid));

    const canEditMaster =
      isOwner ||
      (row.created_by === membership.memberId && inOnlyAccessibleGroups);
    const canRemoveFromAccessibleGroups =
      isOwner || [...groupIds].some((gid) => accessibleGroupIds.has(gid));

    return {
      id: row.id,
      name: row.name,
      memo: row.memo,
      status: row.status,
      groups,
      courseCount: courseCountsByParticipant.get(row.id) ?? 0,
      canEditMaster,
      canRemoveFromAccessibleGroups,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  const totalCount = count ?? rows.length;
  return apiOk({
    participants,
    pageInfo: {
      page,
      pageSize,
      totalCount,
      hasNextPage: from + rows.length < totalCount,
    },
  });
}

export async function upsertParticipantAction(
  workspaceId: UUID,
  rawInput: UpsertParticipantInput,
): Promise<ApiResult<{ participantId: UUID }>> {
  const parsed = UpsertParticipantSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }
  const input = parsed.data;

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const accessibleGroupIds = await loadAccessibleGroupIds(workspaceId);
  const isOwner = membership.role === "owner_admin";
  const isGroupAdmin = membership.role === "group_admin";
  const now = new Date().toISOString();

  if (input.id) {
    // 수정
    const { data: existing, error: fetchError } = await supabase
      .from("participants")
      .select("id, created_by, status")
      .eq("workspace_id", workspaceId)
      .eq("id", input.id)
      .maybeSingle();
    if (fetchError || !existing) {
      return apiError("NOT_FOUND", "참여자를 찾을 수 없습니다.");
    }

    if (!isOwner) {
      if (existing.created_by !== membership.memberId) {
        return apiError("ROLE_FORBIDDEN", "이 참여자를 수정할 권한이 없습니다.");
      }
      const currentGroups = await loadParticipantActiveGroupIds(input.id);
      if (
        currentGroups.length === 0 ||
        !currentGroups.every((gid) => accessibleGroupIds.has(gid))
      ) {
        return apiError("SCOPE_FORBIDDEN", "이 참여자를 수정할 권한이 없습니다.");
      }
    }

    const updates: Record<string, unknown> = {
      name: input.name,
      memo: input.memo ?? null,
      updated_at: now,
    };
    if (isOwner) {
      updates.status = input.status;
    }

    const { error: updateError } = await admin
      .from("participants")
      .update(updates)
      .eq("workspace_id", workspaceId)
      .eq("id", input.id);
    if (updateError) {
      return apiError("INTERNAL_ERROR", updateError.message);
    }

    revalidatePath(`/workspaces/${workspaceId}/manage/participants`);
    revalidatePath(`/workspaces/${workspaceId}/manage/groups`);
    revalidatePath(`/workspaces/${workspaceId}/manage/courses`);
    revalidatePath(`/workspaces/${workspaceId}/home`);
    return apiOk({ participantId: input.id });
  }

  // 생성
  const groupIdsForInsert = input.groupIds ?? [];

  if (isGroupAdmin) {
    if (groupIdsForInsert.length === 0) {
      return apiError(
        "VALIDATION_FAILED",
        "참여자를 추가할 그룹을 1개 이상 선택해 주세요.",
      );
    }
    if (!groupIdsForInsert.every((gid) => accessibleGroupIds.has(gid))) {
      return apiError(
        "SCOPE_FORBIDDEN",
        "접근 권한이 있는 그룹만 선택할 수 있습니다.",
      );
    }
  } else if (!isOwner) {
    return apiError("ROLE_FORBIDDEN", "참여자 생성 권한이 없습니다.");
  }

  const { data: created, error: createError } = await admin
    .from("participants")
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      memo: input.memo ?? null,
      status: input.status,
      created_by: membership.memberId,
    })
    .select("id")
    .single();

  if (createError || !created) {
    return apiError(
      "INTERNAL_ERROR",
      createError?.message ?? "참여자를 만들지 못했습니다.",
    );
  }

  if (groupIdsForInsert.length > 0) {
    const rows = groupIdsForInsert.map((groupId) => ({
      workspace_id: workspaceId,
      participant_id: created.id,
      group_id: groupId,
      status: "active" as const,
    }));
    const { error: linkError } = await admin
      .from("participant_groups")
      .insert(rows);
    if (linkError) {
      return apiError("INTERNAL_ERROR", linkError.message);
    }
  }

  revalidatePath(`/workspaces/${workspaceId}/manage/participants`);
  revalidatePath(`/workspaces/${workspaceId}/manage/groups`);
  revalidatePath(`/workspaces/${workspaceId}/manage/courses`);
  revalidatePath(`/workspaces/${workspaceId}/home`);
  return apiOk({ participantId: created.id });
}

export async function updateParticipantGroupsAction(
  workspaceId: UUID,
  participantId: UUID,
  rawInput: UpdateParticipantGroupsInput,
): Promise<ApiResult<{ groupIds: UUID[] }>> {
  const parsed = UpdateParticipantGroupsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const accessibleGroupIds = await loadAccessibleGroupIds(workspaceId);
  const isOwner = membership.role === "owner_admin";

  const currentGroupIds = await loadParticipantActiveGroupIds(participantId);
  const currentSet = new Set(currentGroupIds);
  const targetSet = new Set(parsed.data.groupIds);
  const now = new Date().toISOString();

  let toActivate: UUID[];
  let toRemove: UUID[];

  if (isOwner) {
    toActivate = parsed.data.groupIds.filter((id) => !currentSet.has(id));
    toRemove = currentGroupIds.filter((id) => !targetSet.has(id));
  } else {
    if (!parsed.data.groupIds.every((id) => accessibleGroupIds.has(id))) {
      return apiError(
        "SCOPE_FORBIDDEN",
        "접근 권한이 있는 그룹만 선택할 수 있습니다.",
      );
    }
    toActivate = parsed.data.groupIds.filter((id) => !currentSet.has(id));
    toRemove = currentGroupIds.filter(
      (id) => accessibleGroupIds.has(id) && !targetSet.has(id),
    );
  }

  if (toRemove.length > 0) {
    const { error } = await admin
      .from("participant_groups")
      .update({ status: "removed", updated_at: now })
      .eq("workspace_id", workspaceId)
      .eq("participant_id", participantId)
      .in("group_id", toRemove);
    if (error) return apiError("INTERNAL_ERROR", error.message);
  }

  if (toActivate.length > 0) {
    const { data: existingRemoved, error: fetchError } = await supabase
      .from("participant_groups")
      .select("group_id")
      .eq("workspace_id", workspaceId)
      .eq("participant_id", participantId)
      .in("group_id", toActivate);
    if (fetchError) return apiError("INTERNAL_ERROR", fetchError.message);
    const existingSet = new Set(
      (existingRemoved ?? []).map((row) => row.group_id as UUID),
    );

    const toUpdate = toActivate.filter((id) => existingSet.has(id));
    const toInsert = toActivate.filter((id) => !existingSet.has(id));

    if (toUpdate.length > 0) {
      const { error } = await admin
        .from("participant_groups")
        .update({ status: "active", updated_at: now })
        .eq("workspace_id", workspaceId)
        .eq("participant_id", participantId)
        .in("group_id", toUpdate);
      if (error) return apiError("INTERNAL_ERROR", error.message);
    }
    if (toInsert.length > 0) {
      const rows = toInsert.map((groupId) => ({
        workspace_id: workspaceId,
        participant_id: participantId,
        group_id: groupId,
        status: "active" as const,
      }));
      const { error } = await admin.from("participant_groups").insert(rows);
      if (error) return apiError("INTERNAL_ERROR", error.message);
    }
  }

  const finalGroupIds = await loadParticipantActiveGroupIds(participantId);
  revalidatePath(`/workspaces/${workspaceId}/manage/participants`);
  revalidatePath(`/workspaces/${workspaceId}/manage/groups`);
  revalidatePath(`/workspaces/${workspaceId}/manage/courses`);
  revalidatePath(`/workspaces/${workspaceId}/home`);
  return apiOk({ groupIds: finalGroupIds });
}

export async function deleteParticipantAction(
  workspaceId: UUID,
  participantId: UUID,
): Promise<ApiResult<{ id: UUID }>> {
  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role !== "owner_admin") {
    return apiError("ROLE_FORBIDDEN", "참여자 삭제는 대표 운영자만 가능합니다.");
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("participants")
    .update({ status: "deleted", deleted_at: now, updated_at: now })
    .eq("workspace_id", workspaceId)
    .eq("id", participantId);
  if (error) return apiError("INTERNAL_ERROR", error.message);

  revalidatePath(`/workspaces/${workspaceId}/manage/participants`);
  revalidatePath(`/workspaces/${workspaceId}/manage/groups`);
  revalidatePath(`/workspaces/${workspaceId}/manage/courses`);
  revalidatePath(`/workspaces/${workspaceId}/home`);
  return apiOk({ id: participantId });
}

// --- internal helpers ---

type CurrentMembership = {
  memberId: UUID;
  role: "owner_admin" | "group_admin" | "instructor";
};

async function loadCurrentMembership(
  workspaceId: UUID,
): Promise<CurrentMembership | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return { memberId: data.id, role: data.role };
}

async function loadAccessibleGroupIds(workspaceId: UUID): Promise<Set<UUID>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("accessible_group_ids", {
    target_workspace_id: workspaceId,
  });
  const ids: UUID[] = Array.isArray(data)
    ? (data as Array<string | { accessible_group_ids: string }>).map((row) =>
        typeof row === "string" ? row : (row.accessible_group_ids ?? ""),
      )
    : [];
  return new Set(ids.filter((id) => id.length > 0));
}

async function loadParticipantActiveGroupIds(
  participantId: UUID,
): Promise<UUID[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("participant_groups")
    .select("group_id")
    .eq("participant_id", participantId)
    .eq("status", "active");
  return (data ?? []).map((row) => row.group_id as UUID);
}

async function loadGroupsByParticipant(
  participantIds: UUID[],
): Promise<Map<UUID, GroupSummary[]>> {
  const result = new Map<UUID, GroupSummary[]>();
  if (participantIds.length === 0) return result;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("participant_groups")
    .select(
      "participant_id, group:groups!inner ( id, name, description, status, deleted_at )",
    )
    .in("participant_id", participantIds)
    .eq("status", "active");

  for (const row of data ?? []) {
    const group = row.group as unknown as
      | {
          id: UUID;
          name: string;
          description: string | null;
          status: GroupSummary["status"];
          deleted_at: string | null;
        }
      | null;
    if (!group || group.deleted_at) continue;
    const summary: GroupSummary = {
      id: group.id,
      name: group.name,
      description: group.description,
      status: group.status,
    };
    const pid = row.participant_id as UUID;
    const list = result.get(pid) ?? [];
    list.push(summary);
    result.set(pid, list);
  }
  return result;
}

async function loadCourseCountsByParticipant(
  participantIds: UUID[],
): Promise<Map<UUID, number>> {
  const counts = new Map<UUID, number>();
  if (participantIds.length === 0) return counts;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_participants")
    .select("participant_id")
    .in("participant_id", participantIds)
    .eq("status", "active");
  for (const row of data ?? []) {
    const pid = row.participant_id as UUID;
    counts.set(pid, (counts.get(pid) ?? 0) + 1);
  }
  return counts;
}

function collectFieldErrors(
  error: import("zod").ZodError,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    (result[path] ??= []).push(issue.message);
  }
  return result;
}
