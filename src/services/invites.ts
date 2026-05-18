"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { ISODateTime, UUID } from "@/lib/api/types";
import { generateInviteToken, hashInviteToken } from "@/lib/invites/token";
import {
  CreateInviteSchema,
  type CreateInviteInput,
} from "@/lib/validators/workspace-member";

import { logActivity } from "./activity";
import { isBlockingInviteDuplicateStatus } from "./invites.duplicates";

export type AcceptInviteOutput = {
  workspaceId: UUID;
};

export type CreateInviteOutput = {
  inviteId: UUID;
  memberId: UUID;
  inviteUrl: string;
  expiresAt: ISODateTime;
};

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
  const tokenHash = hashInviteToken(token);

  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .select("id, workspace_id, member_id, expires_at, accepted_at, role")
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
    return apiError("INTERNAL_ERROR", inviteUpdateError.message);
  }

  await logActivity({
    workspaceId: invite.workspace_id,
    actorMemberId: invite.member_id,
    eventType: "invite_accepted",
    targetType: "member",
    targetId: invite.member_id,
    metadata: {
      email: user.email ?? "",
      role: invite.role,
    },
  });

  return apiOk({ workspaceId: invite.workspace_id });
}

/**
 * Owner-admin creates an invite (api-spec.md §6.2).
 *
 * Flow:
 *  1. Validate input (Zod) and confirm caller is an active owner_admin.
 *  2. Validate role-scoped IDs (group_admin → groupIds belong to workspace,
 *     instructor → courseIds belong to workspace).
 *  3. Insert a placeholder `workspace_members` row (status='invited', user_id=null).
 *  4. Insert `workspace_member_groups` rows for group_admin, `invite_courses`
 *     rows for instructor.
 *  5. Generate a URL-safe token + sha256 hash, persist into `invites`.
 *  6. Ask Supabase Auth to generate a magic-link / invite email so the
 *     recipient lands on /auth/callback?next=/accept-invite?token=<raw>.
 *  7. Best-effort step-wise rollback on any later failure so a retry stays
 *     clean. The returned `inviteUrl` is the Supabase action_link — usable
 *     both for clicking and for manual copy-paste sharing.
 *
 * Uses admin client (same RLS-bypass pattern as materials/attendance) because
 * `invites` / `invite_groups` / `invite_courses` policies do not allow the
 * insert path to be reached cleanly under SSR.
 */
export async function createInvite(
  workspaceId: UUID,
  rawInput: CreateInviteInput,
): Promise<ApiResult<CreateInviteOutput>> {
  const parsed = CreateInviteSchema.safeParse(rawInput);
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
  if (!user) {
    return apiError("AUTH_REQUIRED", "로그인이 필요합니다.");
  }

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
    return apiError("ROLE_FORBIDDEN", "초대는 대표 운영자만 가능합니다.");
  }

  const normalizedGroupIds =
    input.role === "group_admin" ? input.groupIds ?? [] : [];
  const normalizedCourseIds =
    input.role === "instructor" ? input.courseIds ?? [] : [];

  if (normalizedGroupIds.length > 0) {
    const { data: groups } = await supabase
      .from("groups")
      .select("id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .in("id", normalizedGroupIds);
    const found = new Set((groups ?? []).map((g) => g.id));
    if (found.size !== normalizedGroupIds.length) {
      return apiError(
        "VALIDATION_FAILED",
        "선택한 그룹 중 일부를 찾을 수 없습니다.",
      );
    }
  }
  if (normalizedCourseIds.length > 0) {
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .eq("workspace_id", workspaceId)
      .in("id", normalizedCourseIds);
    const found = new Set((courses ?? []).map((c) => c.id));
    if (found.size !== normalizedCourseIds.length) {
      return apiError(
        "VALIDATION_FAILED",
        "선택한 수업 중 일부를 찾을 수 없습니다.",
      );
    }
  }

  const admin = createSupabaseAdminClient();

  const { data: duplicate } = await admin
    .from("workspace_members")
    .select("id, status")
    .eq("workspace_id", workspaceId)
    .eq("email", input.email)
    .neq("status", "removed")
    .maybeSingle();
  if (duplicate && isBlockingInviteDuplicateStatus(duplicate.status)) {
    return apiError("CONFLICT", "이미 등록된 이메일입니다.");
  }

  const matchedUserId = await findAuthUserIdByEmailSafe(input.email);

  // Step 3: placeholder workspace_members row
  const { data: insertedMember, error: memberError } = await admin
    .from("workspace_members")
    .insert({
      workspace_id: workspaceId,
      email: input.email,
      display_name: input.displayName,
      role: input.role,
      status: "invited",
      user_id: null,
    })
    .select("id")
    .single();
  if (memberError || !insertedMember) {
    return apiError(
      "INTERNAL_ERROR",
      memberError?.message ?? "초대 멤버 생성에 실패했습니다.",
    );
  }
  const memberId: UUID = insertedMember.id;

  // Step 4a: group_admin scope
  if (normalizedGroupIds.length > 0) {
    const rows = normalizedGroupIds.map((groupId) => ({
      workspace_id: workspaceId,
      member_id: memberId,
      group_id: groupId,
    }));
    const { error: groupErr } = await admin
      .from("workspace_member_groups")
      .insert(rows);
    if (groupErr) {
      await rollbackMember(admin, memberId);
      return apiError("INTERNAL_ERROR", groupErr.message);
    }
  }

  // Step 5: invite row with hashed token
  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  const { data: insertedInvite, error: inviteInsertError } = await admin
    .from("invites")
    .insert({
      workspace_id: workspaceId,
      member_id: memberId,
      token_hash: tokenHash,
      role: input.role,
      expires_at: expiresAt.toISOString(),
      created_by: me.id,
    })
    .select("id")
    .single();
  if (inviteInsertError || !insertedInvite) {
    await rollbackMemberGroups(admin, memberId, normalizedGroupIds.length > 0);
    await rollbackMember(admin, memberId);
    return apiError(
      "INTERNAL_ERROR",
      inviteInsertError?.message ?? "초대 토큰 발급에 실패했습니다.",
    );
  }
  const inviteId: UUID = insertedInvite.id;

  // Step 4b: instructor → invite_courses
  if (normalizedCourseIds.length > 0) {
    const rows = normalizedCourseIds.map((courseId) => ({
      invite_id: inviteId,
      course_id: courseId,
      workspace_id: workspaceId,
    }));
    const { error: courseErr } = await admin
      .from("invite_courses")
      .insert(rows);
    if (courseErr) {
      await admin.from("invites").delete().eq("id", inviteId);
      await rollbackMemberGroups(admin, memberId, normalizedGroupIds.length > 0);
      await rollbackMember(admin, memberId);
      return apiError("INTERNAL_ERROR", courseErr.message);
    }
  }

  // Step 6: trigger Supabase magic-link / invite email
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const acceptPath = `/accept-invite?token=${encodeURIComponent(token)}`;
  const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent(acceptPath)}`;

  let inviteUrl: string;
  try {
    const linkType: "magiclink" | "invite" = matchedUserId
      ? "magiclink"
      : "invite";
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: linkType,
        email: input.email,
        options: { redirectTo },
      });
    const actionLink = linkData?.properties?.action_link;
    if (linkError || !actionLink) {
      throw new Error(linkError?.message ?? "매직 링크 생성에 실패했습니다.");
    }
    inviteUrl = actionLink;
  } catch (err) {
    if (normalizedCourseIds.length > 0) {
      await admin.from("invite_courses").delete().eq("invite_id", inviteId);
    }
    await admin.from("invites").delete().eq("id", inviteId);
    await rollbackMemberGroups(admin, memberId, normalizedGroupIds.length > 0);
    await rollbackMember(admin, memberId);
    const message =
      err instanceof Error ? err.message : "매직 링크 발송에 실패했습니다.";
    return apiError("INTERNAL_ERROR", message);
  }

  await logActivity({
    workspaceId,
    actorMemberId: me.id,
    eventType: "invite_created",
    targetType: "member",
    targetId: memberId,
    metadata: {
      email: input.email,
      role: input.role,
    },
  });

  revalidatePath(`/workspaces/${workspaceId}/members`);

  return apiOk({
    inviteId,
    memberId,
    inviteUrl,
    expiresAt: expiresAt.toISOString(),
  });
}

// --- internal helpers ---

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

async function rollbackMember(admin: AdminClient, memberId: UUID): Promise<void> {
  await admin.from("workspace_members").delete().eq("id", memberId);
}

async function rollbackMemberGroups(
  admin: AdminClient,
  memberId: UUID,
  hadGroups: boolean,
): Promise<void> {
  if (!hadGroups) return;
  await admin.from("workspace_member_groups").delete().eq("member_id", memberId);
}

/**
 * Best-effort auth user lookup by email. Isolated so an env mis-config
 * (e.g. service_role JWT mix-up) does not block invite creation.
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

function collectFieldErrors(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    (result[path] ??= []).push(issue.message);
  }
  return result;
}
