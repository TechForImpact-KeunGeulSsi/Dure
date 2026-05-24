"use server";

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { CourseSessionSummary, CourseStatus, UUID } from "@/lib/api/types";

export type InstructorCourseHomeOutput = {
  course: {
    id: UUID;
    name: string;
    status: CourseStatus;
    startsOn: string | null;
    endsOn: string | null;
    cardColor: string | null;
    bannerUrl: string | null;
  };
  todaySessions: Array<
    CourseSessionSummary & {
      attendanceSavedCount: number;
      attendanceTargetCount: number;
      classMemo: string | null;
    }
  >;
  upcomingSessions: CourseSessionSummary[];
  cancelledSessions: CourseSessionSummary[];
  materialCount: number;
  pendingMaterialCount: number;
};

const SESSION_SELECT =
  "id, course_id, session_no, date, starts_at, ends_at, type, visibility_status, rollup_status, progress_status, cancellation_reason";

/**
 * api-spec.md §13.1 강사 수업 홈 조회.
 * 담당 강사만 호출 가능. 출석 카운트/메모는 단계 7-3, 7-4에서 채워짐.
 */
export async function getInstructorCourseHome(
  workspaceId: UUID,
  courseId: UUID,
  today?: string,
): Promise<ApiResult<InstructorCourseHomeOutput>> {
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
  if (!me) return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, name, status, starts_on, ends_on, card_color, banner_url, instructor_member_id",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");
  if (course.instructor_member_id !== me.id) {
    return apiError("ROLE_FORBIDDEN", "이 수업의 담당 강사가 아닙니다.");
  }

  const todayDate = today ?? new Date().toISOString().slice(0, 10);

  const [todayRows, upcomingRows, cancelledRows, materialTotal, materialPending] =
    await Promise.all([
      loadScheduledSessionsByDate(workspaceId, courseId, todayDate, "eq"),
      loadScheduledSessionsByDate(workspaceId, courseId, todayDate, "gt"),
      loadCancelledSessions(workspaceId, courseId),
      countMaterials(workspaceId, courseId),
      countMaterials(workspaceId, courseId, "pending"),
    ]);

  const todaySessions = todayRows.map((s) => ({
    ...mapSession(s, course.name),
    attendanceSavedCount: 0,
    attendanceTargetCount: 0,
    classMemo: null,
  }));
  const upcomingSessions = upcomingRows.map((s) => mapSession(s, course.name));
  const cancelledSessions = cancelledRows.map((s) => mapSession(s, course.name));

  return apiOk({
    course: {
      id: course.id,
      name: course.name,
      status: course.status,
      startsOn: course.starts_on,
      endsOn: course.ends_on,
      cardColor: course.card_color,
      bannerUrl: course.banner_url,
    },
    todaySessions,
    upcomingSessions,
    cancelledSessions,
    materialCount: materialTotal,
    pendingMaterialCount: materialPending,
  });
}

type SessionRow = {
  id: UUID;
  course_id: UUID;
  session_no: number;
  date: string;
  starts_at: string;
  ends_at: string;
  type: CourseSessionSummary["type"];
  visibility_status: CourseSessionSummary["visibilityStatus"];
  rollup_status: CourseSessionSummary["rollupStatus"];
  progress_status: CourseSessionSummary["progressStatus"];
  cancellation_reason: string | null;
};

async function loadScheduledSessionsByDate(
  workspaceId: UUID,
  courseId: UUID,
  date: string,
  op: "eq" | "gt",
): Promise<SessionRow[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("course_sessions")
    .select(SESSION_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .eq("progress_status", "scheduled");
  q = op === "eq" ? q.eq("date", date) : q.gt("date", date);
  q = q.order("date", { ascending: true }).order("starts_at", { ascending: true });

  const { data } = await q;
  return (data ?? []) as SessionRow[];
}

async function loadCancelledSessions(
  workspaceId: UUID,
  courseId: UUID,
): Promise<SessionRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_sessions")
    .select(SESSION_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .eq("progress_status", "cancelled")
    .order("session_no", { ascending: true });

  return (data ?? []) as SessionRow[];
}

function mapSession(row: SessionRow, courseName: string): CourseSessionSummary {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName,
    sessionNo: row.session_no,
    date: row.date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    type: row.type,
    visibilityStatus: row.visibility_status,
    rollupStatus: row.rollup_status,
    progressStatus: row.progress_status,
    cancellationReason: row.cancellation_reason,
  };
}

async function countMaterials(
  workspaceId: UUID,
  courseId: UUID,
  reviewStatus?: "pending" | "reviewed",
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("materials")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId);
  if (reviewStatus) q = q.eq("review_status", reviewStatus);

  const { count } = await q;
  return count ?? 0;
}
