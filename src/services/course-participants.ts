"use server";

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  courseParticipantId: UUID;
  participant: ParticipantRef;
  assignmentGroups: GroupRef[];
  assignmentStatus: CourseParticipantStatus;
  presentCount: number;
  partialCount: number;
  absentCount: number;
  attendanceRate: number | null;
  latestNote: string | null;
  canEditAssignment: boolean;
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
    partialCount: number;
    absentCount: number;
    countedSessionCount: number;
  };
  participants: ParticipantStatusItem[];
};

/**
 * 수업 참여자 현황. 단계 7-5에서 `attendance_records` 집계를 채웠다.
 *
 * - `countedSessionCount`: 코스의 `rollup_status='included'` 회차 수.
 * - 개인 `attendanceRate` = `(presentCount + partialCount * 0.5) / countedSessionCount`.
 *   `countedSessionCount === 0`이면 `null`.
 * - 전체 `summary.attendanceRate` = 전체 기록 평균(같은 가중치).
 * - `latestNote`: 가장 최근 `attendance_records.note`(있으면).
 */
export async function getCourseParticipantsStatus(
  workspaceId: UUID,
  courseId: UUID,
): Promise<ApiResult<GetCourseParticipantsStatusResult>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, status, starts_on, ends_on, card_color, banner_url")
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const [rawParticipantRows, countedSessionIds] = await Promise.all([
    loadCourseParticipantRows(workspaceId, courseId),
    loadCountedSessionIds(workspaceId, courseId),
  ]);

  const countedSessionCount = countedSessionIds.length;
  const aggregates = await loadAttendanceAggregates({
    workspaceId,
    countedSessionIds,
  });

  const participants: ParticipantStatusItem[] = rawParticipantRows.map((row) => {
    const participantId = row.participant?.id ?? "";
    const agg = aggregates.byParticipant.get(participantId) ?? EMPTY_AGG;

    return {
      courseParticipantId: row.id,
      participant: {
        id: participantId,
        name: row.participant?.name ?? row.participant_name_snapshot,
        email: null,
        status: row.participant?.status ?? "deleted",
      },
      assignmentGroups: row.groupRefs,
      assignmentStatus: row.status,
      presentCount: agg.present,
      partialCount: agg.partial,
      absentCount: agg.absent,
      attendanceRate: computeRate(agg, countedSessionCount),
      latestNote: aggregates.latestNoteByParticipant.get(participantId) ?? null,
      canEditAssignment: true,
    };
  });

  const totalAgg = participants.reduce(
    (acc, p) => ({
      present: acc.present + p.presentCount,
      partial: acc.partial + p.partialCount,
      absent: acc.absent + p.absentCount,
    }),
    { present: 0, partial: 0, absent: 0 },
  );

  const totalDenom = countedSessionCount * participants.length;
  const summaryRate =
    totalDenom > 0
      ? Math.round(
          ((totalAgg.present + totalAgg.partial * 0.5) / totalDenom) * 1000,
        ) / 10
      : null;

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
    summary: {
      attendanceRate: summaryRate,
      partialCount: totalAgg.partial,
      absentCount: totalAgg.absent,
      countedSessionCount,
    },
    participants,
  });
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

type Aggregate = { present: number; partial: number; absent: number };
const EMPTY_AGG: Aggregate = { present: 0, partial: 0, absent: 0 };

function computeRate(agg: Aggregate, countedSessionCount: number): number | null {
  if (countedSessionCount === 0) return null;
  const score = agg.present + agg.partial * 0.5;
  return Math.round((score / countedSessionCount) * 1000) / 10;
}

type ParticipantRow = {
  id: UUID;
  participant_name_snapshot: string;
  status: CourseParticipantStatus;
  participant: ParticipantRef | null;
  groupRefs: GroupRef[];
};

async function loadCourseParticipantRows(
  workspaceId: UUID,
  courseId: UUID,
): Promise<ParticipantRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_participants")
    .select(
      `id, participant_name_snapshot, status,
       participant:participants ( id, name, status ),
       groups:course_participant_groups ( group:groups ( id, name, description, status ) )`,
    )
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .order("assigned_at", { ascending: true });

  return (data ?? []).map((raw) => {
    const r = raw as unknown as {
      id: UUID;
      participant_name_snapshot: string;
      status: CourseParticipantStatus;
      participant: { id: UUID; name: string; status: ParticipantStatus } | null;
      groups: Array<{ group: GroupRef | null }>;
    };
    return {
      id: r.id,
      participant_name_snapshot: r.participant_name_snapshot,
      status: r.status,
      participant: r.participant
        ? {
            id: r.participant.id,
            name: r.participant.name,
            email: null,
            status: r.participant.status,
          }
        : null,
      groupRefs: (r.groups ?? [])
        .map((link) => link.group)
        .filter((g): g is GroupRef => g !== null),
    };
  });
}

async function loadCountedSessionIds(
  workspaceId: UUID,
  courseId: UUID,
): Promise<UUID[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_sessions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .eq("rollup_status", "included");
  return (data ?? []).map((row) => row.id as UUID);
}

async function loadAttendanceAggregates(params: {
  workspaceId: UUID;
  countedSessionIds: UUID[];
}): Promise<{
  byParticipant: Map<UUID, Aggregate>;
  latestNoteByParticipant: Map<UUID, string>;
}> {
  const byParticipant = new Map<UUID, Aggregate>();
  const latestNoteByParticipant = new Map<UUID, string>();
  if (params.countedSessionIds.length === 0) {
    return { byParticipant, latestNoteByParticipant };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_records")
    .select("participant_id, status, note, updated_at")
    .eq("workspace_id", params.workspaceId)
    .in("session_id", params.countedSessionIds)
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as Array<{
    participant_id: UUID;
    status: AttendanceStatus;
    note: string | null;
    updated_at: string;
  }>;

  for (const row of rows) {
    // 카운트
    const prev = byParticipant.get(row.participant_id) ?? { ...EMPTY_AGG };
    if (row.status === "present") prev.present += 1;
    else if (row.status === "partial") prev.partial += 1;
    else if (row.status === "absent") prev.absent += 1;
    byParticipant.set(row.participant_id, prev);

    // 최근 메모 (정렬이 desc이므로 최초 등장이 최신)
    if (
      row.note &&
      row.note.trim().length > 0 &&
      !latestNoteByParticipant.has(row.participant_id)
    ) {
      latestNoteByParticipant.set(row.participant_id, row.note);
    }
  }

  return { byParticipant, latestNoteByParticipant };
}