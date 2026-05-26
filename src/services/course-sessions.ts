"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { CourseSessionSummary, UUID } from "@/lib/api/types";

/**
 * 수업 회차 목록. 단계 5 mock(`getCourseSessions`)을 대체한다.
 * RLS가 자동으로 권한 필터링을 수행한다.
 */
export async function getCourseSessions(
  workspaceId: UUID,
  courseId: UUID,
): Promise<ApiResult<CourseSessionSummary[]>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: course } = await supabase
    .from("courses")
    .select("name")
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const { data, error } = await supabase
    .from("course_sessions")
    .select(
      "id, course_id, session_no, date, starts_at, ends_at, type, visibility_status, rollup_status, progress_status, cancellation_reason",
    )
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .order("session_no", { ascending: true });
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const sessions: CourseSessionSummary[] = (data ?? []).map((row) => ({
    id: row.id,
    courseId: row.course_id,
    courseName: course.name,
    sessionNo: row.session_no,
    date: row.date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    type: row.type,
    visibilityStatus: row.visibility_status,
    rollupStatus: row.rollup_status,
    progressStatus: row.progress_status,
    cancellationReason: row.cancellation_reason ?? null,
  }));

  return apiOk(sessions);
}

/**
 * 회차 삭제. CASCADE로 attendance_records와 class_memos도 함께 제거되며,
 * 캘린더(course_sessions 직접 조회)에서도 자동으로 사라진다.
 */
export async function deleteCourseSession(
  workspaceId: UUID,
  sessionId: UUID,
): Promise<ApiResult<void>> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 회차를 삭제할 수 없습니다.");
  }

  const admin = createSupabaseAdminClient();

  const { data: session, error: sessionError } = await admin
    .from("course_sessions")
    .select("id, course_id, workspace_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) return apiError("INTERNAL_ERROR", sessionError.message);
  if (!session || session.workspace_id !== workspaceId) {
    return apiError("NOT_FOUND", "회차를 찾을 수 없습니다.");
  }
  const courseId = session.course_id as UUID;

  if (membership.role === "group_admin") {
    const { data: accessibleRows } = await supabase.rpc("accessible_group_ids", {
      target_workspace_id: workspaceId,
    });
    const accessibleGroupIds = new Set<UUID>(
      Array.isArray(accessibleRows)
        ? (accessibleRows as Array<string | { accessible_group_ids: string }>).map(
            (row) =>
              typeof row === "string" ? row : (row.accessible_group_ids ?? ""),
          )
        : [],
    );
    const { data: courseGroups } = await admin
      .from("course_groups")
      .select("group_id")
      .eq("workspace_id", workspaceId)
      .eq("course_id", courseId);
    const courseGroupIds = (courseGroups ?? []).map(
      (row) => row.group_id as UUID,
    );
    const allInAccess =
      courseGroupIds.length > 0 &&
      courseGroupIds.every((id) => accessibleGroupIds.has(id));
    if (!allInAccess) {
      return apiError(
        "SCOPE_FORBIDDEN",
        "이 수업의 일부 그룹에 접근 권한이 없어 회차를 삭제할 수 없습니다.",
      );
    }
  }

  const { error: deleteError } = await admin
    .from("course_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("workspace_id", workspaceId);
  if (deleteError) return apiError("INTERNAL_ERROR", deleteError.message);

  revalidatePath(`/workspaces/${workspaceId}/courses/${courseId}/home`);
  revalidatePath(`/workspaces/${workspaceId}/teach/courses/${courseId}/home`);
  revalidatePath(`/workspaces/${workspaceId}/teach/courses/${courseId}/attendance`);
  revalidatePath(`/workspaces/${workspaceId}/calendar`);
  revalidatePath(`/workspaces/${workspaceId}/home`);

  return apiOk(undefined as never);
}
