import "server-only";

import { createHash } from "node:crypto";

import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { UUID } from "@/lib/api/types";

export type AcceptInviteOutput = {
  workspaceId: UUID;
};

/**
 * Accepts an invite by linking the placeholder workspace_members row to the
 * current authenticated Supabase user (api-spec.md §6.4).
 *
 * - Token hash uses sha256(token) hex — matches the token_hash column.
 * - Uses the service-role admin client because a fresh user is not yet a
 *   workspace member, so RLS would block the lookup/update via the user
 *   client.
 */
export async function acceptInvite(
  rawToken: string,
): Promise<ApiResult<AcceptInviteOutput>> {
  const token = rawToken.trim();
  if (!token) {
    return apiError("VALIDATION_FAILED", "초대 토큰이 없습니다.");
  }

  const user = await requireUser();
  const admin = createSupabaseAdminClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .select("id, workspace_id, member_id, expires_at, accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (inviteError || !invite) {
    return apiError("NOT_FOUND", "초대를 찾을 수 없습니다.");
  }

  if (invite.accepted_at) {
    return apiError("INVITE_ALREADY_ACCEPTED", "이미 사용된 초대입니다.");
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return apiError("INVITE_EXPIRED", "초대 링크가 만료되었습니다.");
  }

  const now = new Date().toISOString();

  const { error: memberUpdateError } = await admin
    .from("workspace_members")
    .update({
      user_id: user.id,
      status: "active",
      updated_at: now,
    })
    .eq("id", invite.member_id)
    .eq("workspace_id", invite.workspace_id);

  if (memberUpdateError) {
    return apiError("INTERNAL_ERROR", memberUpdateError.message);
  }

  const { error: inviteUpdateError } = await admin
    .from("invites")
    .update({ accepted_at: now, updated_at: now })
    .eq("id", invite.id);

  if (inviteUpdateError) {
    // Membership is already activated; surface a soft error but treat
    // the join as successful — the duplicate accept will fail later.
    return apiError("INTERNAL_ERROR", inviteUpdateError.message);
  }

  return apiOk({ workspaceId: invite.workspace_id });
}
