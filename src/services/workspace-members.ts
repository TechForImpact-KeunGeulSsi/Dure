"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { MemberStatus, UUID, WorkspaceRole } from "@/lib/api/types";
import {
  InviteInstructorSchema,
  type InviteInstructorInput,
} from "@/lib/validators/workspace-member";

export type WorkspaceMemberListItem = {
  id: UUID;
  email: string;
  displayName: string | null;
  role: WorkspaceRole;
  status: MemberStatus;
  isCurrentUser: boolean;
};

export type GetWorkspaceMembersOutput = {
  members: WorkspaceMemberListItem[];
  canInviteInstructor: boolean;
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
    .select("id, email, display_name, role, status, user_id")
    .eq("workspace_id", workspaceId)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const members: WorkspaceMemberListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    isCurrentUser: row.user_id === user.id,
  }));

  return apiOk({
    members,
    canInviteInstructor: me.role === "owner_admin",
  });
}

/**
 * 강사 추가. 같은 이메일의 auth user가 이미 가입돼 있으면 user_id 자동 매핑 + active,
 * 아니면 invited 상태로 보관(단계 8 매직 링크 수락 시 활성화 예정).
 *
 * auth.admin.listUsers는 service_role 권한이 필요한데, 환경변수 설정 문제 등으로
 * 실패할 수 있다(예: "No suitable key or wrong key type"). 그 경우에도 강사 초대
 * 자체는 진행되도록 try-catch로 격리한다 — invited 상태로만 보관되고, 단계 8
 * 정식 흐름이나 Studio 수동 매핑으로 후속 활성화.
 */
export async function inviteInstructor(
  workspaceId: UUID,
  rawInput: InviteInstructorInput,
): Promise<ApiResult<{ memberId: UUID; status: MemberStatus }>> {
  const parsed = InviteInstructorSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.");
  }

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
  if (me.role !== "owner_admin") {
    return apiError("ROLE_FORBIDDEN", "대표 운영자만 강사를 추가할 수 있습니다.");
  }

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (existing) {
    return apiError("CONFLICT", "이미 등록된 이메일입니다.");
  }

  const matchedUserId = await findAuthUserIdByEmailSafe(parsed.data.email);
  const status: MemberStatus = matchedUserId ? "active" : "invited";

  const { data: inserted, error } = await admin
    .from("workspace_members")
    .insert({
      workspace_id: workspaceId,
      email: parsed.data.email,
      display_name: parsed.data.displayName ?? null,
      role: "instructor",
      status,
      user_id: matchedUserId,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return apiError("INTERNAL_ERROR", error?.message ?? "강사를 추가하지 못했습니다.");
  }

  revalidatePath(`/workspaces/${workspaceId}/members`);
  return apiOk({ memberId: inserted.id, status });
}

/**
 * listUsers가 실패해도(JWT 키 문제 등) 강사 초대 흐름이 멈추지 않도록 격리.
 */
async function findAuthUserIdByEmailSafe(email: string): Promise<UUID | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error || !data?.users) return null;
    const found = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    return (found?.id as UUID) ?? null;
  } catch {
    return null;
  }
}