"use server";

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
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
      "id, course_id, session_no, date, starts_at, ends_at, type, visibility_status, rollup_status, progress_status",
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
  }));

  return apiOk(sessions);
}