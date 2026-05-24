"use server";

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  CourseSessionSummary,
  CourseStatus,
  MemberSummary,
  UUID,
} from "@/lib/api/types";

export type SessionMemoItem = {
  session: CourseSessionSummary;
  memo: {
    id: UUID | null;
    content: string;
    updatedBy: MemberSummary | null;
    updatedAt: string | null;
  };
};

export type GetCourseMemosOutput = {
  course: {
    id: UUID;
    name: string;
    status: CourseStatus;
    cardColor: string | null;
  };
  items: SessionMemoItem[];
  canSaveMemo: boolean;
};

/**
 * 강사 콘솔 수업 메모 탭. 모든 회차에 대해 메모 유무와 내용을 함께 반환.
 * 권한 검증은 attendance.ts의 패턴과 동일(담당 강사/owner/접근 그룹 운영자).
 */
export async function getCourseMemos(
  workspaceId: UUID,
  courseId: UUID,
): Promise<ApiResult<GetCourseMemosOutput>> {
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
    .select("id, name, status, card_color, instructor_member_id")
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const allowed = await canAccessCourse({
    workspaceId,
    me: { memberId: me.id, role: me.role },
    course,
  });
  if (!allowed) return apiError("ROLE_FORBIDDEN", "수업 접근 권한이 없습니다.");

  const { data: sessions } = await supabase
    .from("course_sessions")
    .select(
      "id, course_id, session_no, date, starts_at, ends_at, type, visibility_status, rollup_status, progress_status",
    )
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .order("session_no", { ascending: true });

  const sessionList: CourseSessionSummary[] = (sessions ?? []).map((row) => ({
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
    cancellationReason: null,
  }));

  const memos = await loadMemosByCourse(workspaceId, courseId);
  const memoBySession = new Map(memos.map((m) => [m.sessionId, m]));

  const items: SessionMemoItem[] = sessionList.map((s) => {
    const m = memoBySession.get(s.id);
    return {
      session: s,
      memo: m
        ? {
            id: m.id,
            content: m.content,
            updatedBy: m.updatedBy,
            updatedAt: m.updatedAt,
          }
        : { id: null, content: "", updatedBy: null, updatedAt: null },
    };
  });

  return apiOk({
    course: {
      id: course.id,
      name: course.name,
      status: course.status,
      cardColor: course.card_color,
    },
    items,
    canSaveMemo: true,
  });
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

async function canAccessCourse(params: {
  workspaceId: UUID;
  me: { memberId: UUID; role: "owner_admin" | "group_admin" | "instructor" };
  course: { id: UUID; instructor_member_id: UUID | null };
}): Promise<boolean> {
  if (params.me.role === "owner_admin") return true;
  if (
    params.me.role === "instructor" &&
    params.course.instructor_member_id === params.me.memberId
  ) {
    return true;
  }
  if (params.me.role === "group_admin") {
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
  return false;
}

type LoadedMemo = {
  id: UUID;
  sessionId: UUID;
  content: string;
  updatedBy: MemberSummary | null;
  updatedAt: string;
};

async function loadMemosByCourse(
  workspaceId: UUID,
  courseId: UUID,
): Promise<LoadedMemo[]> {
  const supabase = await createSupabaseServerClient();
  const { data: sessionIdsData } = await supabase
    .from("course_sessions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId);
  const sessionIds = (sessionIdsData ?? []).map((r) => r.id as UUID);
  if (sessionIds.length === 0) return [];

  const { data } = await supabase
    .from("class_memos")
    .select(
      `id, session_id, content, updated_at,
       updater:workspace_members!class_memos_updated_by_fkey (
         id, email, display_name, role, status
       )`,
    )
    .eq("workspace_id", workspaceId)
    .in("session_id", sessionIds);

  return (data ?? []).map((row) => {
    const u = row.updater as unknown as MemberSummary | null;
    return {
      id: row.id,
      sessionId: row.session_id,
      content: row.content,
      updatedBy: u ?? null,
      updatedAt: row.updated_at,
    };
  });
}