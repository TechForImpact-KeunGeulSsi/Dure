"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  GroupListItem,
  GroupStatus,
  PageInfo,
  UUID,
} from "@/lib/api/types";
import {
  UpsertGroupSchema,
  type UpsertGroupInput,
} from "@/lib/validators/group";

type GetGroupsPageInput = {
  workspaceId: UUID;
  search?: string;
  status?: GroupStatus;
  page?: number;
  pageSize?: number;
};

export type GetGroupsPageOutput = {
  groups: GroupListItem[];
  pageInfo: PageInfo;
};

const DEFAULT_PAGE_SIZE = 20;

export async function getGroupsPage(
  input: GetGroupsPageInput,
): Promise<ApiResult<GetGroupsPageOutput>> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  await requireUser();
  const supabase = await createSupabaseServerClient();

  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  let query = supabase
    .from("groups")
    .select("id, name, description, status", { count: "exact" })
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .range(from, to);

  if (input.search && input.search.trim().length > 0) {
    query = query.ilike("name", `%${input.search.trim()}%`);
  }
  if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, error, count } = await query;
  if (error) {
    return apiError("INTERNAL_ERROR", error.message);
  }
  const rows = data ?? [];
  const ids = rows.map((row) => row.id);

  const { participantCounts, courseCounts } = await loadGroupCounts(ids);

  const canManageLifecycle = membership.role === "owner_admin";
  const canEditDescription =
    membership.role === "owner_admin" || membership.role === "group_admin";

  const groups: GroupListItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    participantCount: participantCounts.get(row.id) ?? 0,
    courseCount: courseCounts.get(row.id) ?? 0,
    canEditDescription,
    canManageLifecycle,
  }));

  const totalCount = count ?? rows.length;
  const pageInfo: PageInfo = {
    page,
    pageSize,
    totalCount,
    hasNextPage: from + rows.length < totalCount,
  };

  return apiOk({ groups, pageInfo });
}

export async function upsertGroupAction(
  workspaceId: UUID,
  rawInput: UpsertGroupInput,
): Promise<ApiResult<{ group: GroupListItem }>> {
  const parsed = UpsertGroupSchema.safeParse(rawInput);
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

  const input = parsed.data;
  const isOwner = membership.role === "owner_admin";

  // group_admin은 description-only 수정만 가능 (api-spec.md §7.2).
  // 현재 RLS는 owner만 write 허용이므로 admin client로 우회 (플랜 RLS 충돌 섹션 참고).
  if (!isOwner) {
    if (!input.id) {
      return apiError("ROLE_FORBIDDEN", "그룹 생성은 대표 운영자만 가능합니다.");
    }
    return updateGroupDescriptionAsGroupAdmin({
      workspaceId,
      groupId: input.id,
      description: input.description ?? null,
      memberRole: membership.role,
    });
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (input.id) {
    const { data, error } = await supabase
      .from("groups")
      .update({
        name: input.name,
        description: input.description ?? null,
        status: input.status,
        updated_at: now,
      })
      .eq("workspace_id", workspaceId)
      .eq("id", input.id)
      .select("id, name, description, status")
      .single();

    if (error || !data) {
      return apiError("INTERNAL_ERROR", error?.message ?? "그룹을 수정하지 못했습니다.");
    }
    revalidatePath(`/workspaces/${workspaceId}/manage/groups`);
    return apiOk({
      group: toGroupListItem(data, { isOwner, canEditDescription: true }),
    });
  }

  const { data, error } = await supabase
    .from("groups")
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      description: input.description ?? null,
      status: input.status,
    })
    .select("id, name, description, status")
    .single();

  if (error || !data) {
    return apiError("INTERNAL_ERROR", error?.message ?? "그룹을 만들지 못했습니다.");
  }

  revalidatePath(`/workspaces/${workspaceId}/manage/groups`);
  return apiOk({
    group: toGroupListItem(data, { isOwner, canEditDescription: true }),
  });
}

export async function deleteGroupAction(
  workspaceId: UUID,
  groupId: UUID,
): Promise<ApiResult<{ id: UUID }>> {
  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role !== "owner_admin") {
    return apiError("ROLE_FORBIDDEN", "그룹 삭제는 대표 운영자만 가능합니다.");
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("groups")
    .update({ deleted_at: now, updated_at: now })
    .eq("workspace_id", workspaceId)
    .eq("id", groupId);

  if (error) {
    return apiError("INTERNAL_ERROR", error.message);
  }

  revalidatePath(`/workspaces/${workspaceId}/manage/groups`);
  return apiOk({ id: groupId });
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
  const { data } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();

  if (!data) return null;
  return { memberId: data.id, role: data.role };
}

async function loadGroupCounts(groupIds: UUID[]): Promise<{
  participantCounts: Map<UUID, number>;
  courseCounts: Map<UUID, number>;
}> {
  if (groupIds.length === 0) {
    return { participantCounts: new Map(), courseCounts: new Map() };
  }

  const supabase = await createSupabaseServerClient();

  const [participantRes, courseRes] = await Promise.all([
    supabase
      .from("participant_groups")
      .select("group_id")
      .in("group_id", groupIds)
      .eq("status", "active"),
    supabase.from("course_groups").select("group_id").in("group_id", groupIds),
  ]);

  const participantCounts = new Map<UUID, number>();
  for (const row of participantRes.data ?? []) {
    participantCounts.set(
      row.group_id,
      (participantCounts.get(row.group_id) ?? 0) + 1,
    );
  }
  const courseCounts = new Map<UUID, number>();
  for (const row of courseRes.data ?? []) {
    courseCounts.set(row.group_id, (courseCounts.get(row.group_id) ?? 0) + 1);
  }
  return { participantCounts, courseCounts };
}

async function updateGroupDescriptionAsGroupAdmin(params: {
  workspaceId: UUID;
  groupId: UUID;
  description: string | null;
  memberRole: CurrentMembership["role"];
}): Promise<ApiResult<{ group: GroupListItem }>> {
  // Verify the caller actually has this group in their accessible scope.
  const supabase = await createSupabaseServerClient();
  const { data: accessible } = await supabase.rpc("accessible_group_ids", {
    target_workspace_id: params.workspaceId,
  });
  const accessibleIds = new Set<string>(
    Array.isArray(accessible)
      ? (accessible as Array<string | { accessible_group_ids: string }>).map(
          (row) =>
            typeof row === "string" ? row : row.accessible_group_ids ?? "",
        )
      : [],
  );

  if (!accessibleIds.has(params.groupId)) {
    return apiError("SCOPE_FORBIDDEN", "이 그룹을 수정할 권한이 없습니다.");
  }

  // RLS는 owner-only write이므로 admin client로 description만 갱신.
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("groups")
    .update({ description: params.description, updated_at: now })
    .eq("workspace_id", params.workspaceId)
    .eq("id", params.groupId)
    .is("deleted_at", null)
    .select("id, name, description, status")
    .single();

  if (error || !data) {
    return apiError(
      "INTERNAL_ERROR",
      error?.message ?? "그룹 설명을 수정하지 못했습니다.",
    );
  }

  revalidatePath(`/workspaces/${params.workspaceId}/manage/groups`);
  return apiOk({
    group: toGroupListItem(data, {
      isOwner: false,
      canEditDescription: true,
    }),
  });
}

function toGroupListItem(
  row: { id: UUID; name: string; description: string | null; status: GroupStatus },
  flags: { isOwner: boolean; canEditDescription: boolean },
): GroupListItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    participantCount: 0,
    courseCount: 0,
    canEditDescription: flags.canEditDescription,
    canManageLifecycle: flags.isOwner,
  };
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
