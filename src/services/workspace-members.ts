"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { MemberStatus, UUID, WorkspaceRole } from "@/lib/api/types";
import {
  UpdateMemberSchema,
  type UpdateMemberInput,
} from "@/lib/validators/workspace-member";

import { logActivity } from "./activity";
import {
  buildWorkspaceMemberList,
  type WorkspaceMemberListItem as WorkspaceMemberListItemType,
  type WorkspaceMemberRow,
} from "./workspace-members.list";

export type { WorkspaceMemberListItem } from "./workspace-members.list";

export type GetWorkspaceMembersOutput = {
  members: WorkspaceMemberListItemType[];
  canInviteMembers: boolean;
  canInviteOwner: boolean;
  canEditMembers: boolean;
};

export async function getWorkspaceMembers(
  workspaceId: UUID,
): Promise<ApiResult<GetWorkspaceMembersOutput>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("AUTH_REQUIRED", "로그인이 필요합니다.");

  const { data: me } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!me) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("id, email, display_name, memo, role, status, user_id")
    .eq("workspace_id", workspaceId)
    .neq("status", "removed")
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const rows = (data ?? []) as WorkspaceMemberRow[];
  const memberIds = rows.map((row) => row.id as UUID);
  const groupsByMember = await loadMemberGroups(workspaceId, memberIds);
  const members = buildWorkspaceMemberList({
    rows,
    groupsByMember,
    currentUserId: user.id,
  });

  return apiOk({
    members,
    canInviteMembers: me.role === "owner_admin" || me.role === "group_admin",
    canInviteOwner: me.role === "owner_admin",
    canEditMembers: me.role === "owner_admin",
  });
}

/**
 * 멤버 정보 수정 (api-spec.md §6.3).
 *
 * - owner_admin만 호출 가능 (ROLE_FORBIDDEN).
 * - 마지막 활성 owner_admin의 role 변경 / 비활성화 / 제거는 차단 (CONFLICT).
 * - role/groupIds 변경 시 `workspace_member_groups`를 delete-then-insert로 동기화.
 *   (기존 `approveJoinRequest` 패턴과 동일)
 * - admin client 우회 — workspace_members UPDATE / workspace_member_groups는
 *   기존 SSR RLS와 충돌 회피용.
 */
export async function updateMember(
  workspaceId: UUID,
  memberId: UUID,
  rawInput: UpdateMemberInput,
): Promise<ApiResult<{ memberId: UUID }>> {
  const parsed = UpdateMemberSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }
  const input = parsed.data;

  await requireUser();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("AUTH_REQUIRED", "로그인이 필요합니다.");

  const { data: me } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!me) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (me.role !== "owner_admin") {
    return apiError("ROLE_FORBIDDEN", "멤버 정보 수정은 대표 운영자만 가능합니다.");
  }

  const admin = createSupabaseAdminClient();

  const { data: target, error: targetError } = await admin
    .from("workspace_members")
    .select("id, workspace_id, email, role, status")
    .eq("id", memberId)
    .maybeSingle();
  if (targetError) return apiError("INTERNAL_ERROR", targetError.message);
  if (!target || target.workspace_id !== workspaceId) {
    return apiError("NOT_FOUND", "멤버를 찾을 수 없습니다.");
  }

  const nextRole = (input.role ?? target.role) as WorkspaceRole;
  const nextStatus = (input.status ?? target.status) as MemberStatus;

  // Last active owner_admin 보호
  if (target.role === "owner_admin" && target.status === "active") {
    const becomingNonOwner = nextRole !== "owner_admin";
    const becomingInactive = nextStatus !== "active";
    if (becomingNonOwner || becomingInactive) {
      const { data: activeOwners, error: ownerCountError } = await admin
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("role", "owner_admin")
        .eq("status", "active");
      if (ownerCountError) {
        return apiError("INTERNAL_ERROR", ownerCountError.message);
      }
      if ((activeOwners ?? []).length <= 1) {
        return apiError(
          "CONFLICT",
          "마지막 활성 대표 운영자는 역할이나 상태를 변경할 수 없습니다.",
        );
      }
    }
  }

  // group_admin이면 groupIds 워크스페이스 소속 검증
  if (nextRole === "group_admin" && input.groupIds !== undefined) {
    if (input.groupIds.length === 0) {
      return apiError(
        "VALIDATION_FAILED",
        "그룹 운영자는 1개 이상의 그룹을 선택해야 합니다.",
      );
    }
    const { data: groupRows } = await admin
      .from("groups")
      .select("id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .in("id", input.groupIds);
    const found = new Set((groupRows ?? []).map((row) => row.id as UUID));
    if (found.size !== input.groupIds.length) {
      return apiError(
        "VALIDATION_FAILED",
        "선택한 그룹 중 일부를 찾을 수 없습니다.",
      );
    }
  }

  // workspace_members patch
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.displayName !== undefined) updates.display_name = input.displayName;
  if (input.memo !== undefined) updates.memo = input.memo;
  if (input.role !== undefined) updates.role = input.role;
  if (input.status !== undefined) updates.status = input.status;

  const { error: updateError } = await admin
    .from("workspace_members")
    .update(updates)
    .eq("id", memberId)
    .eq("workspace_id", workspaceId);
  if (updateError) return apiError("INTERNAL_ERROR", updateError.message);

  // workspace_member_groups 동기화:
  //   1) role이 group_admin이 아닌 다른 값으로 바뀜 → 기존 행 모두 삭제
  //   2) group_admin이고 groupIds 명시됨 → delete then insert
  const roleChangedAwayFromGroupAdmin =
    input.role !== undefined &&
    target.role === "group_admin" &&
    input.role !== "group_admin";

  if (roleChangedAwayFromGroupAdmin) {
    await admin
      .from("workspace_member_groups")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("member_id", memberId);
  } else if (nextRole === "group_admin" && input.groupIds !== undefined) {
    await admin
      .from("workspace_member_groups")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("member_id", memberId);
    if (input.groupIds.length > 0) {
      const rows = input.groupIds.map((groupId) => ({
        workspace_id: workspaceId,
        member_id: memberId,
        group_id: groupId,
      }));
      const { error: groupInsertError } = await admin
        .from("workspace_member_groups")
        .insert(rows);
      if (groupInsertError) {
        return apiError("INTERNAL_ERROR", groupInsertError.message);
      }
    }
  }

  revalidatePath(`/workspaces/${workspaceId}/members`);
  return apiOk({ memberId });
}

/**
 * 멤버 제거.
 *
 * 기록 보존을 위해 workspace_members row를 물리 삭제하지 않고
 * status='removed'로 전환한다. 초대 대기 멤버는 남아 있는 invite token을
 * 함께 삭제해 이후 수락으로 다시 active가 되는 경로를 닫는다.
 */
export async function removeMember(
  workspaceId: UUID,
  memberId: UUID,
): Promise<ApiResult<{ memberId: UUID }>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("AUTH_REQUIRED", "로그인이 필요합니다.");

  const { data: me } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!me) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (me.role !== "owner_admin") {
    return apiError("ROLE_FORBIDDEN", "멤버 제거는 대표 운영자만 가능합니다.");
  }

  const admin = createSupabaseAdminClient();

  const { data: target, error: targetError } = await admin
    .from("workspace_members")
    .select("id, workspace_id, email, role, status, user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (targetError) return apiError("INTERNAL_ERROR", targetError.message);
  if (!target || target.workspace_id !== workspaceId) {
    return apiError("NOT_FOUND", "멤버를 찾을 수 없습니다.");
  }

  if (target.status === "removed") {
    return apiOk({ memberId });
  }

  if (target.user_id === user.id) {
    return apiError("CONFLICT", "본인 멤버십은 제거할 수 없습니다.");
  }

  if (target.role === "owner_admin" && target.status === "active") {
    const { data: activeOwners, error: ownerCountError } = await admin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("role", "owner_admin")
      .eq("status", "active");
    if (ownerCountError) return apiError("INTERNAL_ERROR", ownerCountError.message);
    if ((activeOwners ?? []).length <= 1) {
      return apiError("CONFLICT", "마지막 활성 대표 운영자는 제거할 수 없습니다.");
    }
  }

  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("workspace_members")
    .update({
      status: "removed",
      updated_at: now,
    })
    .eq("id", memberId)
    .eq("workspace_id", workspaceId);
  if (updateError) return apiError("INTERNAL_ERROR", updateError.message);

  const { error: groupsDeleteError } = await admin
    .from("workspace_member_groups")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("member_id", memberId);
  if (groupsDeleteError) {
    return apiError("INTERNAL_ERROR", groupsDeleteError.message);
  }

  const { error: invitesDeleteError } = await admin
    .from("invites")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("member_id", memberId);
  if (invitesDeleteError) {
    return apiError("INTERNAL_ERROR", invitesDeleteError.message);
  }

  await logActivity({
    workspaceId,
    actorMemberId: me.id,
    eventType: "member_removed",
    targetType: "member",
    targetId: memberId,
    metadata: {
      email: target.email,
      role: target.role,
      previousStatus: target.status,
    },
  });

  revalidatePath(`/workspaces/${workspaceId}/members`);
  return apiOk({ memberId });
}

// --- internal helpers ---

async function loadMemberGroups(
  workspaceId: UUID,
  memberIds: UUID[],
): Promise<Map<UUID, UUID[]>> {
  const result = new Map<UUID, UUID[]>();
  if (memberIds.length === 0) return result;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workspace_member_groups")
    .select("member_id, group_id")
    .eq("workspace_id", workspaceId)
    .in("member_id", memberIds);
  for (const row of data ?? []) {
    const list = result.get(row.member_id as UUID) ?? [];
    list.push(row.group_id as UUID);
    result.set(row.member_id as UUID, list);
  }
  return result;
}

function collectFieldErrors(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    (result[path] ??= []).push(issue.message);
  }
  return result;
}
