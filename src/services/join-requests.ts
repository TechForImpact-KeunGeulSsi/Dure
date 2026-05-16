"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  ISODateTime,
  PageInfo,
  UUID,
  WorkspaceRole,
} from "@/lib/api/types";
import {
  ApproveJoinRequestSchema,
  RequestAccessSchema,
  type ApproveJoinRequestInput,
  type RequestAccessInput,
} from "@/lib/validators/join-request";

// --- Public DTOs ---------------------------------------------------------

export type DiscoverableMembership = "active" | "invited" | "none";

export type DiscoverableWorkspaceItem = {
  workspaceId: UUID;
  name: string;
  timezone: string;
  memberCount: number;
  myMembershipStatus: DiscoverableMembership;
  myPendingRequest: {
    id: UUID;
    desiredRole: WorkspaceRole;
    createdAt: ISODateTime;
  } | null;
};

export type ListDiscoverableInput = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ListDiscoverableOutput = {
  workspaces: DiscoverableWorkspaceItem[];
  pageInfo: PageInfo;
};

export type JoinRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "canceled";

export type JoinRequestListItem = {
  id: UUID;
  workspaceId: UUID;
  user: { userId: UUID; email: string; displayName: string | null };
  desiredRole: WorkspaceRole;
  message: string | null;
  status: JoinRequestStatus;
  createdAt: ISODateTime;
};

// --- listDiscoverableWorkspaces -----------------------------------------

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function listDiscoverableWorkspaces(
  input: ListDiscoverableInput = {},
): Promise<ApiResult<ListDiscoverableOutput>> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = input.search?.trim() ?? "";

  let query = supabase
    .from("workspaces")
    .select("id, name, timezone", { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);
  if (search.length > 0) {
    query = query.ilike("name", `%${escapeIlikePattern(search)}%`);
  }

  const { data: rows, error, count } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const workspaceIds = (rows ?? []).map((row) => row.id as UUID);

  const [memberCountByWs, myMembershipByWs, myPendingByWs] = await Promise.all([
    loadMemberCounts(workspaceIds),
    loadMyMemberships(user.id, workspaceIds),
    loadMyPendingRequests(user.id, workspaceIds),
  ]);

  const workspaces: DiscoverableWorkspaceItem[] = (rows ?? []).map((row) => {
    const id = row.id as UUID;
    return {
      workspaceId: id,
      name: row.name,
      timezone: row.timezone,
      memberCount: memberCountByWs.get(id) ?? 0,
      myMembershipStatus: myMembershipByWs.get(id) ?? "none",
      myPendingRequest: myPendingByWs.get(id) ?? null,
    };
  });

  const totalCount = count ?? workspaces.length;
  const pageInfo: PageInfo = {
    page,
    pageSize,
    totalCount,
    hasNextPage: from + workspaces.length < totalCount,
  };

  return apiOk({ workspaces, pageInfo });
}

// --- requestWorkspaceAccess ---------------------------------------------

export async function requestWorkspaceAccess(
  workspaceId: UUID,
  rawInput: RequestAccessInput,
): Promise<ApiResult<{ requestId: UUID }>> {
  const parsed = RequestAccessSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }
  const input = parsed.data;

  const user = await requireUser();
  const admin = createSupabaseAdminClient();

  // 워크스페이스 존재 확인 (디스커버 정책으로 누구나 SELECT 가능)
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws) {
    return apiError("NOT_FOUND", "워크스페이스를 찾을 수 없습니다.");
  }

  // 이미 active 멤버이면 거부
  const { data: existingMember } = await admin
    .from("workspace_members")
    .select("status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingMember) {
    if (existingMember.status === "active") {
      return apiError("CONFLICT", "이미 참여 중인 워크스페이스입니다.");
    }
    if (existingMember.status === "invited") {
      return apiError(
        "CONFLICT",
        "이메일로 초대 받은 워크스페이스입니다. 초대 메일에서 수락해 주세요.",
      );
    }
  }

  // 이미 pending 요청 있으면 거부 (unique index도 보호하지만 친절한 메시지를 위해 선검사)
  const { data: existingPending } = await admin
    .from("workspace_join_requests")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existingPending) {
    return apiError("CONFLICT", "이미 참여 요청을 보냈습니다.");
  }

  const displayName =
    input.displayName ??
    (typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim() || null
      : null);

  const { data: inserted, error: insertError } = await admin
    .from("workspace_join_requests")
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      email: user.email ?? "",
      display_name: displayName,
      desired_role: input.desiredRole,
      message: input.message,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return apiError(
      "INTERNAL_ERROR",
      insertError?.message ?? "참여 요청을 보내지 못했습니다.",
    );
  }

  revalidatePath("/workspaces/discover");
  revalidatePath(`/workspaces/${workspaceId}/members`);
  return apiOk({ requestId: inserted.id });
}

// --- cancelMyJoinRequest ------------------------------------------------

export async function cancelMyJoinRequest(
  requestId: UUID,
): Promise<ApiResult<void>> {
  const user = await requireUser();
  const admin = createSupabaseAdminClient();

  const { data: req } = await admin
    .from("workspace_join_requests")
    .select("id, user_id, workspace_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return apiError("NOT_FOUND", "요청을 찾을 수 없습니다.");
  if (req.user_id !== user.id) {
    return apiError("ROLE_FORBIDDEN", "본인의 요청만 취소할 수 있습니다.");
  }
  if (req.status !== "pending") {
    return apiError("CONFLICT", "대기 중인 요청만 취소할 수 있습니다.");
  }

  const { error } = await admin
    .from("workspace_join_requests")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return apiError("INTERNAL_ERROR", error.message);

  revalidatePath("/workspaces/discover");
  revalidatePath(`/workspaces/${req.workspace_id}/members`);
  return apiOk(undefined as never);
}

// --- listWorkspaceJoinRequests (owner_admin view) -----------------------

export async function listWorkspaceJoinRequests(
  workspaceId: UUID,
  filter: { status?: JoinRequestStatus } = { status: "pending" },
): Promise<ApiResult<JoinRequestListItem[]>> {
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
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }
  if (me.role !== "owner_admin") {
    return apiError(
      "ROLE_FORBIDDEN",
      "참여 요청은 대표 운영자만 확인할 수 있습니다.",
    );
  }

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("workspace_join_requests")
    .select(
      "id, workspace_id, user_id, email, display_name, desired_role, message, status, created_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (filter.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const items: JoinRequestListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    user: {
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
    },
    desiredRole: row.desired_role,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  }));

  return apiOk(items);
}

// --- approveJoinRequest -------------------------------------------------

export async function approveJoinRequest(
  workspaceId: UUID,
  requestId: UUID,
  rawInput: ApproveJoinRequestInput,
): Promise<ApiResult<{ memberId: UUID }>> {
  const parsed = ApproveJoinRequestSchema.safeParse(rawInput);
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
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }
  if (me.role !== "owner_admin") {
    return apiError(
      "ROLE_FORBIDDEN",
      "참여 요청 수락은 대표 운영자만 가능합니다.",
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: req } = await admin
    .from("workspace_join_requests")
    .select(
      "id, workspace_id, user_id, email, display_name, status",
    )
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.workspace_id !== workspaceId) {
    return apiError("NOT_FOUND", "요청을 찾을 수 없습니다.");
  }
  if (req.status !== "pending") {
    return apiError("CONFLICT", "대기 중인 요청만 수락할 수 있습니다.");
  }

  if (input.role === "group_admin" && input.groupIds && input.groupIds.length > 0) {
    const { data: groups } = await admin
      .from("groups")
      .select("id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .in("id", input.groupIds);
    const found = new Set((groups ?? []).map((g) => g.id));
    if (found.size !== input.groupIds.length) {
      return apiError(
        "VALIDATION_FAILED",
        "선택한 그룹 중 일부를 찾을 수 없습니다.",
      );
    }
  }

  // 기존 멤버십 처리
  const { data: existing } = await admin
    .from("workspace_members")
    .select("id, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", req.user_id)
    .maybeSingle();

  let memberId: UUID;
  const now = new Date().toISOString();

  if (existing) {
    if (existing.status === "active") {
      // 이미 활성 — 요청만 approved로 종결
      memberId = existing.id;
    } else {
      const { error: updErr } = await admin
        .from("workspace_members")
        .update({
          status: "active",
          role: input.role,
          display_name: req.display_name,
          user_id: req.user_id,
          email: req.email,
          updated_at: now,
        })
        .eq("id", existing.id);
      if (updErr) {
        return apiError("INTERNAL_ERROR", updErr.message);
      }
      memberId = existing.id;
    }
  } else {
    // 새 active 멤버 INSERT — 이메일 중복은 (workspace_id, email) unique
    // 제약이 없는 경우에만 안전. 안전 차원에서 이메일 중복도 검사.
    const { data: emailDup } = await admin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("email", req.email)
      .maybeSingle();
    if (emailDup) {
      return apiError(
        "CONFLICT",
        "동일 이메일의 멤버가 이미 존재합니다.",
      );
    }
    const { data: inserted, error: insErr } = await admin
      .from("workspace_members")
      .insert({
        workspace_id: workspaceId,
        user_id: req.user_id,
        email: req.email,
        display_name: req.display_name,
        role: input.role,
        status: "active",
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      return apiError(
        "INTERNAL_ERROR",
        insErr?.message ?? "멤버를 추가하지 못했습니다.",
      );
    }
    memberId = inserted.id;
  }

  // group_admin 스코프 동기화: 기존 행 모두 지우고 새로 INSERT
  if (input.role === "group_admin") {
    await admin
      .from("workspace_member_groups")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("member_id", memberId);
    if (input.groupIds && input.groupIds.length > 0) {
      const rows = input.groupIds.map((groupId) => ({
        workspace_id: workspaceId,
        member_id: memberId,
        group_id: groupId,
      }));
      const { error: groupErr } = await admin
        .from("workspace_member_groups")
        .insert(rows);
      if (groupErr) {
        return apiError("INTERNAL_ERROR", groupErr.message);
      }
    }
  }

  // 요청 상태 갱신
  const { error: reqErr } = await admin
    .from("workspace_join_requests")
    .update({
      status: "approved",
      reviewed_by: me.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", requestId);
  if (reqErr) {
    return apiError("INTERNAL_ERROR", reqErr.message);
  }

  revalidatePath(`/workspaces/${workspaceId}/members`);
  revalidatePath("/workspaces/discover");
  return apiOk({ memberId });
}

// --- rejectJoinRequest --------------------------------------------------

export async function rejectJoinRequest(
  workspaceId: UUID,
  requestId: UUID,
  reason?: string,
): Promise<ApiResult<void>> {
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
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }
  if (me.role !== "owner_admin") {
    return apiError(
      "ROLE_FORBIDDEN",
      "참여 요청 거부는 대표 운영자만 가능합니다.",
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: req } = await admin
    .from("workspace_join_requests")
    .select("id, status, workspace_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.workspace_id !== workspaceId) {
    return apiError("NOT_FOUND", "요청을 찾을 수 없습니다.");
  }
  if (req.status !== "pending") {
    return apiError("CONFLICT", "대기 중인 요청만 거부할 수 있습니다.");
  }

  const now = new Date().toISOString();
  const trimmedReason = reason?.trim();
  const { error } = await admin
    .from("workspace_join_requests")
    .update({
      status: "rejected",
      reject_reason:
        trimmedReason && trimmedReason.length > 0 ? trimmedReason : null,
      reviewed_by: me.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", requestId);
  if (error) return apiError("INTERNAL_ERROR", error.message);

  revalidatePath(`/workspaces/${workspaceId}/members`);
  revalidatePath("/workspaces/discover");
  return apiOk(undefined as never);
}

// --- internal helpers ---------------------------------------------------

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function loadMemberCounts(
  workspaceIds: UUID[],
): Promise<Map<UUID, number>> {
  const counts = new Map<UUID, number>();
  if (workspaceIds.length === 0) return counts;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .in("workspace_id", workspaceIds)
    .eq("status", "active");
  for (const row of data ?? []) {
    counts.set(row.workspace_id, (counts.get(row.workspace_id) ?? 0) + 1);
  }
  return counts;
}

async function loadMyMemberships(
  userId: UUID,
  workspaceIds: UUID[],
): Promise<Map<UUID, DiscoverableMembership>> {
  const result = new Map<UUID, DiscoverableMembership>();
  if (workspaceIds.length === 0) return result;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workspace_members")
    .select("workspace_id, status")
    .eq("user_id", userId)
    .in("workspace_id", workspaceIds);
  for (const row of data ?? []) {
    if (row.status === "active" || row.status === "invited") {
      result.set(row.workspace_id, row.status);
    }
  }
  return result;
}

async function loadMyPendingRequests(
  userId: UUID,
  workspaceIds: UUID[],
): Promise<
  Map<UUID, { id: UUID; desiredRole: WorkspaceRole; createdAt: ISODateTime }>
> {
  const result = new Map<
    UUID,
    { id: UUID; desiredRole: WorkspaceRole; createdAt: ISODateTime }
  >();
  if (workspaceIds.length === 0) return result;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workspace_join_requests")
    .select("id, workspace_id, desired_role, created_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .in("workspace_id", workspaceIds);
  for (const row of data ?? []) {
    result.set(row.workspace_id, {
      id: row.id,
      desiredRole: row.desired_role,
      createdAt: row.created_at,
    });
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
