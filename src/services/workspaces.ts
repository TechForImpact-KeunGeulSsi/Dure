"use server";

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import {
  apiError,
  apiOk,
  type ApiResult,
} from "@/lib/api/errors";
import type {
  GetWorkspaceContextOutput,
  GroupSummary,
  MemberSummary,
  UUID,
  WorkspaceCapabilities,
  WorkspaceSummary,
} from "@/lib/api/types";
import {
  CreateWorkspaceInputSchema,
  type CreateWorkspaceInput,
} from "@/lib/validators/workspace";

export type MyWorkspaceListItem = {
  id: UUID;
  name: string;
  timezone: string;
  role: MemberSummary["role"];
};

/**
 * Returns the workspaces where the current user has an ACTIVE membership.
 * Inactive/invited memberships are excluded (architecture.md §8).
 */
export async function listMyWorkspaces(): Promise<MyWorkspaceListItem[]> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  // 본인 user_id를 명시적으로 필터링한다. workspace_members RLS는 워크스페이스의
  // 모든 멤버를 볼 수 있게 허용하므로, 필터 없이는 같은 워크스페이스에 여러 멤버가
  // 있을 때 같은 workspace_id가 여러 번 반환되어 React key 충돌이 발생한다.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      "role, workspace:workspaces!inner ( id, name, timezone )",
    )
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error || !data) {
    return [];
  }

  return data
    .map((row) => {
      const ws = row.workspace as unknown as
        | { id: UUID; name: string; timezone: string }
        | null;
      if (!ws) return null;
      return {
        id: ws.id,
        name: ws.name,
        timezone: ws.timezone,
        role: row.role,
      } satisfies MyWorkspaceListItem;
    })
    .filter((row): row is MyWorkspaceListItem => row !== null);
}

/**
 * Server Action: create a workspace using the create_workspace(name, timezone)
 * RPC defined in supabase/migrations/.../initial_schema.sql.
 *
 * The RPC also inserts the first owner_admin membership for the current user.
 */
export async function createWorkspaceAction(
  input: CreateWorkspaceInput,
): Promise<ApiResult<{ workspaceId: UUID }>> {
  const parsed = CreateWorkspaceInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "_";
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors,
    });
  }

  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("create_workspace", {
    workspace_name: parsed.data.name,
    workspace_timezone: parsed.data.timezone,
  });

  if (error) {
    return apiError("INTERNAL_ERROR", error.message);
  }

  const workspaceId = extractWorkspaceId(data);
  if (!workspaceId) {
    return apiError("INTERNAL_ERROR", "워크스페이스 ID를 확인할 수 없습니다.");
  }

  // auth user metadata에 담긴 이름을 워크스페이스 멤버 표시 이름으로 동기화.
  const metaName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  if (metaName.length > 0) {
    await supabase
      .from("workspace_members")
      .update({ display_name: metaName })
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id);
  }

  // 첫 그룹은 선택값. 입력했을 때만 생성.
  const firstGroupName = parsed.data.firstGroupName?.trim();
  if (firstGroupName && firstGroupName.length > 0) {
    const { error: groupError } = await supabase.from("groups").insert({
      workspace_id: workspaceId,
      name: firstGroupName,
      status: "active",
    });
    if (groupError) {
      // 워크스페이스는 이미 생성되었으므로 사용자에게는 부드러운 경고만.
      console.warn("first group creation failed:", groupError.message);
    }
  }

  return apiOk({ workspaceId });
}

function extractWorkspaceId(value: unknown): UUID | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) {
    return extractWorkspaceId(value[0]);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidate = obj.id ?? obj.workspace_id;
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

/**
 * Resolves the per-workspace context used by every dashboard page
 * (api-spec.md §3.1).
 */
export async function getWorkspaceContext(
  workspaceId: UUID,
): Promise<ApiResult<GetWorkspaceContextOutput>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) {
  return apiError("AUTH_REQUIRED", "로그인이 필요합니다.");
}

const { data: memberRow, error: memberError } = await supabase
  .from("workspace_members")
  .select("id, email, display_name, role, status")
  .eq("workspace_id", workspaceId)
  .eq("user_id", user.id)
  .eq("status", "active")
  .maybeSingle();

  if (memberError || !memberRow) {
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "이 워크스페이스에 접근할 권한이 없습니다.",
    );
  }

  const { data: wsRow, error: wsError } = await supabase
    .from("workspaces")
    .select("id, name, timezone")
    .eq("id", workspaceId)
    .maybeSingle();

  if (wsError || !wsRow) {
    return apiError("NOT_FOUND", "워크스페이스를 찾을 수 없습니다.");
  }

  const member: MemberSummary = {
    id: memberRow.id,
    email: memberRow.email,
    displayName: memberRow.display_name,
    role: memberRow.role,
    status: memberRow.status,
  };

  const workspace: WorkspaceSummary = {
    id: wsRow.id,
    name: wsRow.name,
    timezone: wsRow.timezone,
    currentMember: member,
  };

  const accessibleGroups = await loadAccessibleGroups(workspaceId, member);
  const capabilities = capabilitiesForRole(member.role);

  return apiOk({ workspace, accessibleGroups, capabilities });
}

async function loadAccessibleGroups(
  workspaceId: UUID,
  member: MemberSummary,
): Promise<GroupSummary[]> {
  // Instructors don't see groups in the operator nav (api-spec.md §3.1).
  if (member.role === "instructor") return [];

  const supabase = await createSupabaseServerClient();

  if (member.role === "owner_admin") {
    const { data } = await supabase
      .from("groups")
      .select("id, name, description, status")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("name");
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
    }));
  }

  // group_admin — scope to the groups linked through workspace_member_groups.
  const { data } = await supabase
    .from("workspace_member_groups")
    .select(
      "group:groups!inner ( id, name, description, status, deleted_at )",
    )
    .eq("workspace_id", workspaceId)
    .eq("member_id", member.id);

  return (data ?? [])
    .map((row) => {
      const g = row.group as unknown as
        | {
            id: UUID;
            name: string;
            description: string | null;
            status: GroupSummary["status"];
            deleted_at: string | null;
          }
        | null;
      if (!g || g.deleted_at) return null;
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        status: g.status,
      } satisfies GroupSummary;
    })
    .filter((row): row is GroupSummary => row !== null);
}

function capabilitiesForRole(
  role: MemberSummary["role"],
): WorkspaceCapabilities {
  switch (role) {
    case "owner_admin":
      return {
        canManageMembers: true,
        canCreateGroups: true,
        canCreateCourses: true,
        canCreateParticipants: true,
        canViewGeneralSchedule: true,
        canViewRecentActivity: true,
      };
    case "group_admin":
      return {
        canManageMembers: false,
        canCreateGroups: false,
        canCreateCourses: true,
        canCreateParticipants: true,
        canViewGeneralSchedule: true,
        canViewRecentActivity: true,
      };
    case "instructor":
      return {
        canManageMembers: false,
        canCreateGroups: false,
        canCreateCourses: false,
        canCreateParticipants: false,
        canViewGeneralSchedule: false,
        canViewRecentActivity: true,
      };
  }
}
