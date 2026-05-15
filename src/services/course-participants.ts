"use server";

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  CourseParticipantStatus,
  CourseStatus,
  GroupStatus,
  ParticipantStatus,
  UUID,
} from "@/lib/api/types";

// 단계 5 클라이언트(`participants-status-client.tsx`)가 받는 형태와 정확히 맞춘다.
// types/course.ts 의 GetCourseParticipantsStatusOutput 와 호환.
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
 * 수업 참여자 현황. 출석 카운트는 단계 7에서 attendance_records 가 채워지면
 * 같은 함수에 집계 쿼리를 더하면 된다. 현재는 0/null 로 보낸다.
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

  const { data: rows } = await supabase
    .from("course_participants")
    .select(
      `id, participant_name_snapshot, status,
       participant:participants ( id, name, status ),
       groups:course_participant_groups ( group:groups ( id, name, description, status ) )`,
    )
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .order("assigned_at", { ascending: true });

  const participants: ParticipantStatusItem[] = (rows ?? []).map((row) =>
    toParticipantStatusItem(row),
  );

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
      attendanceRate: null,
      partialCount: 0,
      absentCount: 0,
      countedSessionCount: 0,
    },
    participants,
  });
}

type RawCourseParticipantRow = {
  id: UUID;
  participant_name_snapshot: string;
  status: CourseParticipantStatus;
  participant:
    | { id: UUID; name: string; status: ParticipantStatus }
    | null;
  groups: Array<{
    group: { id: UUID; name: string; description: string | null; status: GroupStatus } | null;
  }>;
};

function toParticipantStatusItem(rawRow: unknown): ParticipantStatusItem {
  const row = rawRow as RawCourseParticipantRow;
  const groupLinks = row.groups ?? [];

  return {
    courseParticipantId: row.id,
    participant: {
      id: row.participant?.id ?? "",
      name: row.participant?.name ?? row.participant_name_snapshot,
      email: null, // participants 테이블에 email 컬럼 없음 (mock 호환을 위해 null).
      status: row.participant?.status ?? "deleted",
    },
    assignmentGroups: groupLinks
      .map((link) => link.group)
      .filter((g): g is NonNullable<typeof g> => g !== null),
    assignmentStatus: row.status,
    presentCount: 0,
    partialCount: 0,
    absentCount: 0,
    attendanceRate: null,
    latestNote: null,
    canEditAssignment: true,
  };
}