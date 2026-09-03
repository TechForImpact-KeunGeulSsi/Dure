"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  AttendanceStatus,
  CourseParticipantStatus,
  CourseStatus,
  GroupStatus,
  ParticipantStatus,
  UUID,
} from "@/lib/api/types";

// ─────────────────────────────────────────────────────────────
// 수업 참여자 명단 = 현재 연결된 활성 그룹의 활성 마스터 멤버.
// course_participants 행은 "명시 제외(status='excluded') 추적" 전용으로 사용.
// 그룹 멤버십에 들어 있고 명시 제외되지 않은 참여자는 자동으로 노출된다.
// 데이터 로더는 admin client로 RLS를 우회하며, 호출부에서 권한을 검증한다.
// ─────────────────────────────────────────────────────────────

type GroupRef = {
  id: UUID;
  name: string;
  description: string | null;
  status: GroupStatus;
};

type ParticipantRef = {
  id: UUID;
  name: string;
  email: string | null;
  status: ParticipantStatus;
};

type ParticipantStatusItem = {
  courseParticipantId: UUID | null;
  participant: ParticipantRef;
  assignmentGroups: GroupRef[];
  assignmentStatus: CourseParticipantStatus;
  presentCount: number;
  partialCount: number;
  absentCount: number;
  attendedSessionCount: number;
  validSessionCount: number;
  attendanceRate: number | null;
  latestNote: string | null;
  canEditAssignment: boolean;
};

export type CourseSessionRef = {
  id: UUID;
  sessionNo: number;
  date: string;
  startsAt: string;
  endsAt: string;
};

export type SessionAttendanceRecord = {
  sessionId: UUID;
  participantId: UUID;
  status: AttendanceStatus;
  note: string | null;
};

export type GetCourseParticipantsStatusResult = {
  course: {
    id: UUID;
    name: string;
    status: CourseStatus;
    startsOn: string | null;
    endsOn: string | null;
    cardColor: string | null;
    bannerUrl: string | null;
  };
  summary: {
    attendanceRate: number | null;
    attendedSessionCount: number;
    validSessionCount: number;
    partialCount: number;
    absentCount: number;
    countedSessionCount: number;
  };
  participants: ParticipantStatusItem[];
  /**
   * 회차별 출결 보기를 위한 데이터.
   * - sessions: 누적 통계에 포함되는 회차(rollup_status='included') 목록을 회차 번호 순으로.
   * - records: 회차별 출결 기록. (sessionId, participantId)로 조인해서 사용.
   */
  sessionsView: {
    sessions: CourseSessionRef[];
    records: SessionAttendanceRecord[];
  };
};

export async function getCourseParticipantsStatus(
  workspaceId: UUID,
  courseId: UUID,
): Promise<ApiResult<GetCourseParticipantsStatusResult>> {
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

  const admin = createSupabaseAdminClient();
  const { data: courseRow } = await admin
    .from("courses")
    .select(
      "id, name, status, starts_on, ends_on, card_color, banner_url, instructor_member_id",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();
  if (!courseRow) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  // 권한: 운영자 페이지이므로 owner_admin 또는 자기 접근 그룹이 수업과 교차하는 group_admin.
  const accessibleGroupIds = await loadAccessibleGroupIds(workspaceId);
  const isOwner = me.role === "owner_admin";
  if (!isOwner) {
    if (me.role === "instructor") {
      return apiError("ROLE_FORBIDDEN", "이 페이지에 접근할 권한이 없습니다.");
    }
    // group_admin
    const { data: cgs } = await admin
      .from("course_groups")
      .select("group_id")
      .eq("workspace_id", workspaceId)
      .eq("course_id", courseId);
    const hasIntersection = (cgs ?? []).some((r) =>
      accessibleGroupIds.has(r.group_id as UUID),
    );
    if (!hasIntersection) {
      return apiError("SCOPE_FORBIDDEN", "이 수업에 접근할 권한이 없습니다.");
    }
  }

  const [countedSessions, courseGroupIds] = await Promise.all([
    loadCountedSessions(workspaceId, courseId),
    loadCourseGroupIds(workspaceId, courseId),
  ]);
  const countedSessionIds = countedSessions.map((s) => s.id);

  const rawParticipantRows = await loadCourseParticipantRows(
    workspaceId,
    courseId,
    courseGroupIds,
  );

  const countedSessionCount = countedSessionIds.length;
  const assignedAtByParticipant = new Map(
    rawParticipantRows.map((row) => [row.participant.id, row.assignedAt]),
  );
  const aggregates = await loadAttendanceAggregates({
    workspaceId,
    countedSessionIds,
    sessions: countedSessions,
    assignedAtByParticipant,
  });

  const participants: ParticipantStatusItem[] = rawParticipantRows.map((row) => {
    const agg = aggregates.byParticipant.get(row.participant.id) ?? EMPTY_AGG;
    return {
      courseParticipantId: row.courseParticipantId,
      participant: row.participant,
      assignmentGroups: row.groupRefs,
      assignmentStatus: row.status,
      presentCount: agg.present,
      partialCount: agg.partial,
      absentCount: agg.absent,
      attendedSessionCount: agg.present + agg.partial,
      validSessionCount: agg.present + agg.partial + agg.absent,
      attendanceRate: computeRate(agg),
      latestNote: aggregates.latestNoteByParticipant.get(row.participant.id) ?? null,
      canEditAssignment: true,
    };
  });

  const activeParticipants = participants.filter(
    (p) => p.assignmentStatus === "active",
  );
  const totalAgg = activeParticipants.reduce(
    (acc, p) => ({
      present: acc.present + p.presentCount,
      partial: acc.partial + p.partialCount,
      absent: acc.absent + p.absentCount,
    }),
    { present: 0, partial: 0, absent: 0 },
  );

  const totalValidRecordCount = activeParticipants.reduce(
    (total, participant) => total + participant.validSessionCount,
    0,
  );
  const summaryRate =
    totalValidRecordCount > 0
      ? Math.round(
          ((totalAgg.present + totalAgg.partial) / totalValidRecordCount) * 1000,
        ) / 10
      : null;

  return apiOk({
    course: {
      id: courseRow.id,
      name: courseRow.name,
      status: courseRow.status,
      startsOn: courseRow.starts_on,
      endsOn: courseRow.ends_on,
      cardColor: courseRow.card_color,
      bannerUrl: courseRow.banner_url,
    },
    summary: {
      attendanceRate: summaryRate,
      attendedSessionCount: totalAgg.present + totalAgg.partial,
      validSessionCount: totalValidRecordCount,
      partialCount: totalAgg.partial,
      absentCount: totalAgg.absent,
      countedSessionCount,
    },
    participants,
    sessionsView: {
      sessions: countedSessions,
      records: aggregates.sessionRecords,
    },
  });
}

export async function excludeCourseParticipant(
  workspaceId: UUID,
  courseId: UUID,
  participantId: UUID,
): Promise<ApiResult<{ participantId: UUID }>> {
  const guard = await requireOperator(workspaceId);
  if (!guard.ok) return guard;

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: pRow } = await admin
    .from("participants")
    .select("name")
    .eq("workspace_id", workspaceId)
    .eq("id", participantId)
    .maybeSingle();
  if (!pRow) return apiError("NOT_FOUND", "참여자를 찾을 수 없습니다.");

  const { data: existing } = await admin
    .from("course_participants")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("course_participants")
      .update({ status: "excluded", updated_at: now })
      .eq("id", existing.id);
    if (error) return apiError("INTERNAL_ERROR", error.message);
  } else {
    const { error } = await admin.from("course_participants").insert({
      workspace_id: workspaceId,
      course_id: courseId,
      participant_id: participantId,
      status: "excluded",
      participant_name_snapshot: pRow.name,
    });
    if (error) return apiError("INTERNAL_ERROR", error.message);
  }

  revalidatePath(`/workspaces/${workspaceId}/courses/${courseId}/participants`);
  revalidatePath(`/workspaces/${workspaceId}/manage/courses`);
  revalidatePath(`/workspaces/${workspaceId}/home`);
  return apiOk({ participantId });
}

export async function reincludeCourseParticipant(
  workspaceId: UUID,
  courseId: UUID,
  participantId: UUID,
): Promise<ApiResult<{ participantId: UUID }>> {
  const guard = await requireOperator(workspaceId);
  if (!guard.ok) return guard;

  const admin = createSupabaseAdminClient();
  // 명시 제외 행이 있으면 active로 되돌린다. 없으면 그대로 — 그룹 멤버십 기반으로 이미 활성.
  const { data: existing } = await admin
    .from("course_participants")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("course_participants")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return apiError("INTERNAL_ERROR", error.message);
  }

  revalidatePath(`/workspaces/${workspaceId}/courses/${courseId}/participants`);
  revalidatePath(`/workspaces/${workspaceId}/manage/courses`);
  revalidatePath(`/workspaces/${workspaceId}/home`);
  return apiOk({ participantId });
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

type Aggregate = { present: number; partial: number; absent: number };
const EMPTY_AGG: Aggregate = { present: 0, partial: 0, absent: 0 };

function computeRate(agg: Aggregate): number | null {
  const validSessionCount = agg.present + agg.partial + agg.absent;
  if (validSessionCount === 0) return null;
  return Math.round(((agg.present + agg.partial) / validSessionCount) * 1000) / 10;
}

type ParticipantRow = {
  courseParticipantId: UUID | null;
  status: CourseParticipantStatus;
  participant: ParticipantRef;
  groupRefs: GroupRef[];
  assignedAt: string | null;
};

async function loadCourseParticipantRows(
  workspaceId: UUID,
  courseId: UUID,
  linkedGroupIds: UUID[],
): Promise<ParticipantRow[]> {
  if (linkedGroupIds.length === 0) return [];
  const admin = createSupabaseAdminClient();

  // 1) 활성 그룹만 (소프트 삭제 제외)
  const { data: groupRows } = await admin
    .from("groups")
    .select("id, name, description, status")
    .in("id", linkedGroupIds)
    .is("deleted_at", null);
  const groupSummaryById = new Map<UUID, GroupRef>();
  for (const row of groupRows ?? []) {
    groupSummaryById.set(row.id as UUID, {
      id: row.id as UUID,
      name: row.name,
      description: row.description,
      status: row.status,
    });
  }
  if (groupSummaryById.size === 0) return [];

  // 2) 그룹 활성 멤버십
  const { data: pgRows } = await admin
    .from("participant_groups")
    .select("participant_id, group_id")
    .in("group_id", Array.from(groupSummaryById.keys()))
    .eq("status", "active");
  const candidateIds = Array.from(
    new Set((pgRows ?? []).map((row) => row.participant_id as UUID)),
  );
  if (candidateIds.length === 0) return [];

  // 3) 활성 마스터 참여자
  const { data: participantRows } = await admin
    .from("participants")
    .select("id, name, status")
    .in("id", candidateIds)
    .is("deleted_at", null);
  const participantById = new Map<UUID, ParticipantRef>();
  for (const row of participantRows ?? []) {
    if (row.status === "deleted") continue;
    participantById.set(row.id as UUID, {
      id: row.id as UUID,
      name: row.name,
      email: null,
      status: row.status,
    });
  }
  if (participantById.size === 0) return [];

  // 4) course_participants 행 — 명시 제외/명시 활성 상태와 id 매핑용
  const { data: cpRows } = await admin
    .from("course_participants")
    .select("id, participant_id, status, assigned_at")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .in("participant_id", Array.from(participantById.keys()));
  const cpByParticipant = new Map<
    UUID,
    { id: UUID; status: CourseParticipantStatus; assignedAt: string }
  >();
  for (const row of cpRows ?? []) {
    cpByParticipant.set(row.participant_id as UUID, {
      id: row.id as UUID,
      status: row.status,
      assignedAt: row.assigned_at as string,
    });
  }

  // 5) 조합 — 각 멤버십 행을 순회하며 distinct participant + 표시 그룹 집계
  const rowByParticipant = new Map<UUID, ParticipantRow>();
  for (const row of pgRows ?? []) {
    const pid = row.participant_id as UUID;
    const participant = participantById.get(pid);
    if (!participant) continue;
    const groupRef = groupSummaryById.get(row.group_id as UUID);
    if (!groupRef) continue;
    let entry = rowByParticipant.get(pid);
    if (!entry) {
      const cp = cpByParticipant.get(pid);
      entry = {
        courseParticipantId: cp?.id ?? null,
        status: cp?.status ?? "active",
        participant,
        groupRefs: [],
        assignedAt: cp?.assignedAt ?? null,
      };
      rowByParticipant.set(pid, entry);
    }
    if (!entry.groupRefs.some((g) => g.id === groupRef.id)) {
      entry.groupRefs.push(groupRef);
    }
  }

  return Array.from(rowByParticipant.values()).sort((a, b) =>
    a.participant.name.localeCompare(b.participant.name, "ko"),
  );
}

async function loadCountedSessions(
  workspaceId: UUID,
  courseId: UUID,
): Promise<CourseSessionRef[]> {
  const supabase = await createSupabaseServerClient();
  const timezone = await loadWorkspaceTimezone(workspaceId);
  const { data } = await supabase
    .from("course_sessions")
    .select("id, session_no, date, starts_at, ends_at")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .eq("rollup_status", "included")
    .eq("progress_status", "scheduled")
    .order("session_no", { ascending: true });
  const localNow = getLocalNow(new Date(), timezone);
  return (data ?? [])
    .filter((row) => {
      const date = row.date as string;
      if (date < localNow.date) return true;
      if (date > localNow.date) return false;
      return timeToMinutes(row.ends_at as string) <= localNow.minutes;
    })
    .map((row) => ({
      id: row.id as UUID,
      sessionNo: row.session_no as number,
      date: row.date as string,
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
    }));
}

async function loadCourseGroupIds(
  workspaceId: UUID,
  courseId: UUID,
): Promise<UUID[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_groups")
    .select("group_id")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId);
  return (data ?? []).map((row) => row.group_id as UUID);
}

async function loadAccessibleGroupIds(workspaceId: UUID): Promise<Set<UUID>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("accessible_group_ids", {
    target_workspace_id: workspaceId,
  });
  return new Set<UUID>(
    Array.isArray(data)
      ? (data as Array<string | { accessible_group_ids: string }>).map((row) =>
          typeof row === "string" ? row : (row.accessible_group_ids ?? ""),
        )
      : [],
  );
}

async function requireOperator(
  workspaceId: UUID,
): Promise<{ ok: true } | ReturnType<typeof apiError>> {
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
  if (!me)
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  if (me.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 참여자 배정을 변경할 수 없습니다.");
  }
  return { ok: true };
}

async function loadAttendanceAggregates(params: {
  workspaceId: UUID;
  countedSessionIds: UUID[];
  sessions: CourseSessionRef[];
  assignedAtByParticipant: Map<UUID, string | null>;
}): Promise<{
  byParticipant: Map<UUID, Aggregate>;
  latestNoteByParticipant: Map<UUID, string>;
  sessionRecords: SessionAttendanceRecord[];
}> {
  const byParticipant = new Map<UUID, Aggregate>();
  const latestNoteByParticipant = new Map<UUID, string>();
  const sessionRecords: SessionAttendanceRecord[] = [];
  if (params.countedSessionIds.length === 0) {
    return { byParticipant, latestNoteByParticipant, sessionRecords };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_records")
    .select("session_id, participant_id, status, note, updated_at")
    .eq("workspace_id", params.workspaceId)
    .in("session_id", params.countedSessionIds)
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as Array<{
    session_id: UUID;
    participant_id: UUID;
    status: AttendanceStatus;
    note: string | null;
    updated_at: string;
  }>;

  // 같은 (session, participant) 조합은 가장 최근 행 하나만 유지(updated_at 내림차순 정렬되어 있음).
  const seenSessionParticipant = new Set<string>();

  for (const row of rows) {
    const pid = row.participant_id;
    const session = params.sessions.find((item) => item.id === row.session_id);
    const assignedAt = params.assignedAtByParticipant.get(pid);
    if (session && assignedAt && assignedAt.slice(0, 10) > session.date) {
      continue;
    }
    const current = byParticipant.get(pid) ?? { present: 0, partial: 0, absent: 0 };
    if (row.status === "present") current.present += 1;
    else if (row.status === "partial") current.partial += 1;
    else if (row.status === "absent") current.absent += 1;
    byParticipant.set(pid, current);

    if (row.note && row.note.length > 0 && !latestNoteByParticipant.has(pid)) {
      latestNoteByParticipant.set(pid, row.note);
    }

    const dedupKey = `${row.session_id}:${pid}`;
    if (!seenSessionParticipant.has(dedupKey)) {
      seenSessionParticipant.add(dedupKey);
      sessionRecords.push({
        sessionId: row.session_id,
        participantId: pid,
        status: row.status,
        note: row.note,
      });
    }
  }

  return { byParticipant, latestNoteByParticipant, sessionRecords };
}

async function loadWorkspaceTimezone(workspaceId: UUID): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workspaces")
    .select("timezone")
    .eq("id", workspaceId)
    .maybeSingle();
  return data?.timezone ?? "Asia/Seoul";
}

function getLocalNow(value: Date, timezone: string): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: parts.year + "-" + parts.month + "-" + parts.day,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
