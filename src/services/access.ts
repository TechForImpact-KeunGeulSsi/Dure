import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CourseStatus, UUID, WorkspaceRole } from "@/lib/api/types";

/**
 * Shared workspace/course access helpers. Kept separate so that any service
 * (attendance, materials, activity log filtering, …) can reuse the same
 * "is this user allowed to see X" computation.
 *
 * Existing per-service copies (notably in `services/attendance.ts`) are left
 * untouched for now to avoid a churnful refactor; new services should import
 * from this module.
 */

export type CurrentMembership = {
  memberId: UUID;
  role: WorkspaceRole;
};

export async function loadCurrentMembership(
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

export type AccessCourseRow = {
  id: UUID;
  status?: CourseStatus;
  instructor_member_id: UUID | null;
};

/**
 * Returns true when the given workspace membership may view/interact with the
 * given course (api-spec.md §10 / §13 — `can_access_course` contract).
 *
 * - owner_admin: always.
 * - instructor:  course's instructor_member_id matches.
 * - group_admin: at least one of the user's accessible groups appears in
 *                `course_groups` for this course.
 */
export async function canAccessCourse(params: {
  workspaceId: UUID;
  membership: CurrentMembership;
  course: AccessCourseRow;
}): Promise<boolean> {
  if (params.membership.role === "owner_admin") return true;
  if (
    params.membership.role === "instructor" &&
    params.course.instructor_member_id === params.membership.memberId
  ) {
    return true;
  }
  if (params.membership.role !== "group_admin") return false;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("accessible_group_ids", {
    target_workspace_id: params.workspaceId,
  });
  const accessibleIds = new Set<UUID>(
    Array.isArray(data)
      ? (data as Array<string | { accessible_group_ids: string }>).map((row) =>
          typeof row === "string" ? row : (row.accessible_group_ids ?? ""),
        )
      : [],
  );
  if (accessibleIds.size === 0) return false;
  const { data: cgs } = await supabase
    .from("course_groups")
    .select("group_id")
    .eq("workspace_id", params.workspaceId)
    .eq("course_id", params.course.id);
  return (cgs ?? []).some((r) => accessibleIds.has(r.group_id as UUID));
}
