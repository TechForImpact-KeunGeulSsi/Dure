"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  AttendanceStatus,
  CourseSessionSummary,
  CourseStatus,
  GroupSummary,
  MemberSummary,
  UUID,
} from "@/lib/api/types";
import {
  SaveAttendanceSchema,
  SaveClassMemoSchema,
  type SaveAttendanceInput,
  type SaveClassMemoInput,
} from "@/lib/validators/attendance";

// ─────────────────────────────────────────────────────────────
// Types (api-spec.md §15)
// ─────────────────────────────────────────────────────────────

export type AttendanceRecordDto = {
  id: UUID;
  sessionId: UUID;
  participantId: UUID;
  participantNameSnapshot: string;
  status: AttendanceStatus;
  note: string | null;
  updatedBy: MemberSummary | null;
  updatedAt: string;
};

export type AttendanceTarget = {
  participantId: UUID;
  participantName: string;
  assignmentGroups: GroupSummary[];
  record: AttendanceRecordDto | null;
};

export type ClassMemo = {
  id: UUID | null;
  content: string;
  updatedBy: MemberSummary | null;
  updatedAt: string | null;
};

export type GetAttendanceBookOutput = {
  course: {
    id: UUID;
    name: string;
    status: CourseStatus;
    cardColor: string | null;
  };
  sessions: CourseSessionSummary[];
  selectedSession: CourseSessionSummary | null;
  targets: AttendanceTarget[];
  classMemo: ClassMemo;
  canSaveAttendance: boolean;
  canSaveMemo: boolean;
};

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export async function getAttendanceBook(input: {
  workspaceId: UUID;
  courseId: UUID;
  sessionId?: UUID;
}): Promise<ApiResult<GetAttendanceBookOutput>> {
  await requireUser();
  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const course = await loadCourse(input.workspaceId, input.courseId);
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const allowed = await canAccessCourse({
    workspaceId: input.workspaceId,
    membership,
    course,
  });
  if (!allowed) return apiError("ROLE_FORBIDDEN", "수업 접근 권한이 없습니다.");

  const sessions = await loadSessions(input.workspaceId, input.courseId, course.name);
  const selectedSession = pickSession(sessions, input.sessionId);

  const [targets, classMemo] = await Promise.all([
    selectedSession
      ? loadAttendanceTargets(input.workspaceId, input.courseId, selectedSession.id)
      : Promise.resolve<AttendanceTarget[]>([]),
    selectedSession
      ? loadClassMemo(input.workspaceId, selectedSession.id)
      : Promise.resolve<ClassMemo>({ id: null, content: "", updatedBy: null, updatedAt: null }),
  ]);

  return apiOk({
    course: {
      id: course.id,
      name: course.name,
      status: course.status,
      cardColor: course.card_color,
    },
    sessions,
    selectedSession,
    targets,
    classMemo,
    canSaveAttendance: true,
    canSaveMemo: true,
  });
}

export async function saveAttendance(
  workspaceId: UUID,
  rawInput: SaveAttendanceInput,
): Promise<ApiResult<{ records: AttendanceRecordDto[] }>> {
  const parsed = SaveAttendanceSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.");
  }

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const session = await loadSessionWithCourse(workspaceId, parsed.data.sessionId);
  if (!session) return apiError("NOT_FOUND", "회차를 찾을 수 없습니다.");

  const course = await loadCourse(workspaceId, session.course_id);
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const allowed = await canAccessCourse({ workspaceId, membership, course });
  if (!allowed) return apiError("ROLE_FORBIDDEN", "수업 접근 권한이 없습니다.");

  const targets = await loadAttendanceTargets(workspaceId, session.course_id, session.id);
  const validParticipantIds = new Set(targets.map((t) => t.participantId));
  const nameByParticipant = new Map(targets.map((t) => [t.participantId, t.participantName]));

  for (const r of parsed.data.records) {
    if (!validParticipantIds.has(r.participantId)) {
      return apiError("VALIDATION_FAILED", "출석 대상이 아닌 참여자가 포함되어 있습니다.");
    }
  }

  const admin = createSupabaseAdminClient();
  const rowsToUpsert = parsed.data.records.map((r) => ({
    workspace_id: workspaceId,
    session_id: parsed.data.sessionId,
    participant_id: r.participantId,
    participant_name_snapshot: nameByParticipant.get(r.participantId) ?? "",
    status: r.status,
    note: r.note ?? null,
    updated_by: membership.memberId,
  }));

  const { error } = await admin
    .from("attendance_records")
    .upsert(rowsToUpsert, { onConflict: "session_id,participant_id" });
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const saved = await loadAttendanceRecordsBySession(workspaceId, parsed.data.sessionId);
  revalidatePath(`/workspaces/${workspaceId}/teach/courses/${session.course_id}/attendance`);
  return apiOk({ records: saved });
}

export async function saveClassMemo(
  workspaceId: UUID,
  rawInput: SaveClassMemoInput,
): Promise<ApiResult<ClassMemo>> {
  const parsed = SaveClassMemoSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.");
  }

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const session = await loadSessionWithCourse(workspaceId, parsed.data.sessionId);
  if (!session) return apiError("NOT_FOUND", "회차를 찾을 수 없습니다.");

  const course = await loadCourse(workspaceId, session.course_id);
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const allowed = await canAccessCourse({ workspaceId, membership, course });
  if (!allowed) return apiError("ROLE_FORBIDDEN", "수업 접근 권한이 없습니다.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("class_memos")
    .upsert(
      {
        workspace_id: workspaceId,
        session_id: parsed.data.sessionId,
        content: parsed.data.content,
        updated_by: membership.memberId,
      },
      { onConflict: "session_id" },
    );
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const memo = await loadClassMemo(workspaceId, parsed.data.sessionId);
  revalidatePath(`/workspaces/${workspaceId}/teach/courses/${session.course_id}/attendance`);
  return apiOk(memo);
}

// ─────────────────────────────────────────────────────────────
// internal helpers
// ─────────────────────────────────────────────────────────────

type CurrentMembership = {
  memberId: UUID;
  role: "owner_admin" | "group_admin" | "instructor";
};

async function loadCurrentMembership(
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

type CourseRow = {
  id: UUID;
  name: string;
  status: CourseStatus;
  card_color: string | null;
  instructor_member_id: UUID | null;
};

async function loadCourse(workspaceId: UUID, courseId: UUID): Promise<CourseRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("courses")
    .select("id, name, status, card_color, instructor_member_id")
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();
  return data ?? null;
}

async function canAccessCourse(params: {
  workspaceId: UUID;
  membership: CurrentMembership;
  course: CourseRow;
}): Promise<boolean> {
  if (params.membership.role === "owner_admin") return true;
  if (
    params.membership.role === "instructor" &&
    params.course.instructor_member_id === params.membership.memberId
  ) {
    return true;
  }
  if (params.membership.role === "group_admin") {
    // 그룹 운영자: 자기 접근 그룹과 수업 연결 그룹이 교차하면 허용
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

async function loadSessions(
  workspaceId: UUID,
  courseId: UUID,
  courseName: string,
): Promise<CourseSessionSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_sessions")
    .select(
      "id, course_id, session_no, date, starts_at, ends_at, type, visibility_status, rollup_status, progress_status",
    )
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .order("session_no", { ascending: true });

  return (data ?? []).map((row) => ({
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
  }));
}

function pickSession(
  sessions: CourseSessionSummary[],
  sessionId?: UUID,
): CourseSessionSummary | null {
  if (sessions.length === 0) return null;
  if (sessionId) {
    return sessions.find((s) => s.id === sessionId) ?? null;
  }
  const today = new Date().toISOString().slice(0, 10);
  const todays = sessions.filter((s) => s.date === today);
  if (todays.length > 0) return todays[0];
  const upcoming = sessions.find((s) => s.date >= today);
  return upcoming ?? sessions[sessions.length - 1];
}

async function loadAttendanceTargets(
  workspaceId: UUID,
  courseId: UUID,
  sessionId: UUID,
): Promise<AttendanceTarget[]> {
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("course_participants")
    .select(
      `id, participant_name_snapshot, status, participant_id,
       participant:participants ( id, name, status ),
       groups:course_participant_groups ( group:groups ( id, name, description, status ) )`,
    )
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .eq("status", "active");

  const targets: Omit<AttendanceTarget, "record">[] = [];
  for (const row of rows ?? []) {
    const p = row.participant as unknown as { id: UUID; name: string; status: string } | null;
    if (!p || p.status === "deleted") continue;
    const groupLinks = (row.groups ?? []) as unknown as Array<{ group: GroupSummary | null }>;
    const assignmentGroups = groupLinks
      .map((link) => link.group)
      .filter((g): g is GroupSummary => !!g);
    targets.push({
      participantId: p.id,
      participantName: p.name,
      assignmentGroups,
    });
  }

  const records = await loadAttendanceRecordsBySession(workspaceId, sessionId);
  const recordByParticipant = new Map(records.map((r) => [r.participantId, r]));

  return targets.map((t) => ({
    ...t,
    record: recordByParticipant.get(t.participantId) ?? null,
  }));
}

async function loadAttendanceRecordsBySession(
  workspaceId: UUID,
  sessionId: UUID,
): Promise<AttendanceRecordDto[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_records")
    .select(
      `id, session_id, participant_id, participant_name_snapshot, status, note,
       updated_at, updated_by, updater:workspace_members!attendance_records_updated_by_fkey (
         id, email, display_name, role, status
       )`,
    )
    .eq("workspace_id", workspaceId)
    .eq("session_id", sessionId);

  return (data ?? []).map((row) => {
    const u = row.updater as unknown as MemberSummary | null;
    return {
      id: row.id,
      sessionId: row.session_id,
      participantId: row.participant_id,
      participantNameSnapshot: row.participant_name_snapshot,
      status: row.status,
      note: row.note,
      updatedBy: u ?? null,
      updatedAt: row.updated_at,
    };
  });
}

async function loadClassMemo(workspaceId: UUID, sessionId: UUID): Promise<ClassMemo> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("class_memos")
    .select(
      `id, content, updated_at, updater:workspace_members!class_memos_updated_by_fkey (
         id, email, display_name, role, status
       )`,
    )
    .eq("workspace_id", workspaceId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!data) return { id: null, content: "", updatedBy: null, updatedAt: null };
  const u = data.updater as unknown as MemberSummary | null;
  return {
    id: data.id,
    content: data.content,
    updatedBy: u ?? null,
    updatedAt: data.updated_at,
  };
}

async function loadSessionWithCourse(
  workspaceId: UUID,
  sessionId: UUID,
): Promise<{ id: UUID; course_id: UUID } | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_sessions")
    .select("id, course_id")
    .eq("workspace_id", workspaceId)
    .eq("id", sessionId)
    .maybeSingle();
  return data ? { id: data.id, course_id: data.course_id } : null;
}