"use server";

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { MemberStatus, UUID, WorkspaceRole } from "@/lib/api/types";

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
  canInviteMembers: boolean;
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
    canInviteMembers: me.role === "owner_admin",
  });
}
