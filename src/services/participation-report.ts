import "server-only";

import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { AttendanceStatus, UUID } from "@/lib/api/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadCurrentMembership } from "@/services/access";
import {
  filterCoursesByRole,
  getAttendanceDashboard,
} from "@/services/attendance-dashboard";

import {
  buildParticipationReport,
  type ParticipationReport,
  type ParticipationReportParticipantInput,
  type ParticipationReportPeriod,
} from "./participation-report-logic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 1000;

const GetParticipationReportSchema = z.object({
  workspaceId: z.string().uuid(),
  startDate: z.string().regex(DATE),
  endDate: z.string().regex(DATE),
  today: z.string().regex(DATE),
  courseIds: z.array(z.string().uuid()).max(100).optional(),
  gender: z.enum(["female", "male"]).optional(),
  hasDisability: z.boolean().optional(),
  ageBand: z.string().regex(/^\d{1,3}$/).optional(),
});

export type GetParticipationReportInput = z.infer<typeof GetParticipationReportSchema>;

export type ParticipationReportCourseOption = { id: UUID; name: string };

export type ParticipationReportParticipantSummary = {
  id: UUID;
  name: string;
  internalNo: string | null;
};

export type ParticipationReportOutput = ParticipationReport & {
  courseOptions: ParticipationReportCourseOption[];
  participants: ParticipationReportParticipantSummary[];
  missingRecordCount: number;
};

export async function getParticipationReport(
  rawInput: GetParticipationReportInput,
): Promise<ApiResult<ParticipationReportOutput>> {
  const parsed = GetParticipationReportSchema.safeParse(rawInput);
  if (!parsed.success || parsed.data.startDate > parsed.data.endDate) {
    return apiError("VALIDATION_FAILED", "보고서 조회 조건을 확인해 주세요.");
  }
  const input = parsed.data;
  const workspaceId = input.workspaceId as UUID;

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  // 보고서는 운영자 화면이다. 강사는 센터 단위 통계를 보지 않는다.
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "보고서를 볼 권한이 없습니다.");
  }

  const admin = createSupabaseAdminClient();
  const { data: courseRows, error: courseError } = await admin
    .from("courses")
    .select("id, name, status, starts_on, instructor_member_id")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  if (courseError) return apiError("INTERNAL_ERROR", courseError.message);

  const scoped = await filterCoursesByRole({
    workspaceId,
    membership,
    courses: courseRows ?? [],
  });
  if (!scoped.ok) return scoped;
  const courseOptions = scoped.data.map((course) => ({ id: course.id, name: course.name }));
  const scopedCourseIds = courseOptions.map((course) => course.id);

  const empty = buildParticipationReport({
    period: { startDate: input.startDate, endDate: input.endDate },
    ageReferenceYear: Number(input.endDate.slice(0, 4)),
    courses: [],
    sessions: [],
    participants: [],
    records: [],
  });
  if (scopedCourseIds.length === 0) {
    return apiOk({ ...empty, courseOptions, participants: [], missingRecordCount: 0 });
  }

  const { data: sessionRows, error: sessionError } = await admin
    .from("course_sessions")
    .select("id, course_id, date, rollup_status, progress_status")
    .eq("workspace_id", workspaceId)
    .in("course_id", scopedCourseIds)
    .gte("date", input.startDate)
    .lte("date", input.endDate);
  if (sessionError) return apiError("INTERNAL_ERROR", sessionError.message);
  const sessions = (sessionRows ?? []).map((row) => ({
    id: row.id as UUID,
    courseId: row.course_id as UUID,
    date: row.date as string,
    rollupStatus: row.rollup_status as "included" | "excluded",
    progressStatus: row.progress_status as "scheduled" | "cancelled",
  }));

  const recordsResult = await loadRecords(workspaceId, sessions.map((session) => session.id));
  if (!recordsResult.ok) return recordsResult;
  const records = recordsResult.data;

  const participantIds = Array.from(new Set(records.map((record) => record.participantId)));
  const participantsResult = await loadReportParticipants(workspaceId, participantIds);
  if (!participantsResult.ok) return participantsResult;

  const period: ParticipationReportPeriod = {
    startDate: input.startDate,
    endDate: input.endDate,
  };
  const report = buildParticipationReport({
    period,
    ageReferenceYear: Number(input.endDate.slice(0, 4)),
    courses: courseOptions,
    sessions,
    participants: participantsResult.data.map((participant) => participant.report),
    records,
    filter: {
      courseIds: input.courseIds?.filter((id) => scopedCourseIds.includes(id as UUID)) as
        | UUID[]
        | undefined,
      gender: input.gender,
      hasDisability: input.hasDisability,
      ageBand: input.ageBand,
    },
  });

  const missingResult = await countMissingRecords({
    workspaceId,
    today: input.today,
    period,
    courseIds: (input.courseIds as UUID[] | undefined) ?? scopedCourseIds,
  });
  if (!missingResult.ok) return missingResult;

  const evidenceIds = new Set(report.evidence.map((row) => row.participantId));
  return apiOk({
    ...report,
    courseOptions,
    participants: participantsResult.data
      .filter((participant) => evidenceIds.has(participant.summary.id))
      .map((participant) => participant.summary),
    missingRecordCount: missingResult.data,
  });
}

async function loadRecords(
  workspaceId: UUID,
  sessionIds: UUID[],
): Promise<ApiResult<Array<{ sessionId: UUID; participantId: UUID; status: AttendanceStatus }>>> {
  if (sessionIds.length === 0) return apiOk([]);
  const admin = createSupabaseAdminClient();
  const rows: Array<{ sessionId: UUID; participantId: UUID; status: AttendanceStatus }> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("attendance_records")
      .select("id, session_id, participant_id, status")
      .eq("workspace_id", workspaceId)
      .in("session_id", sessionIds)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return apiError("INTERNAL_ERROR", error.message);
    for (const row of data ?? []) {
      rows.push({
        sessionId: row.session_id as UUID,
        participantId: row.participant_id as UUID,
        status: row.status as AttendanceStatus,
      });
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return apiOk(rows);
}

async function loadReportParticipants(
  workspaceId: UUID,
  participantIds: UUID[],
): Promise<
  ApiResult<
    Array<{
      report: ParticipationReportParticipantInput;
      summary: ParticipationReportParticipantSummary;
    }>
  >
> {
  if (participantIds.length === 0) return apiOk([]);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("participants")
    .select("id, name, internal_no, gender, birth_year, has_disability")
    .eq("workspace_id", workspaceId)
    .in("id", participantIds);
  if (error) return apiError("INTERNAL_ERROR", error.message);
  return apiOk(
    (data ?? []).map((row) => ({
      report: {
        id: row.id as UUID,
        gender: (row.gender as "female" | "male" | null) ?? null,
        birthYear: (row.birth_year as number | null) ?? null,
        hasDisability: (row.has_disability as boolean | null) ?? null,
      },
      summary: {
        id: row.id as UUID,
        name: row.name as string,
        internalNo: (row.internal_no as string | null) ?? null,
      },
    })),
  );
}

// 기간 안에 끝난 회차 중 배정된 참여자의 출석이 비어 있는 칸 수 (진행 중 수업 기준)
async function countMissingRecords(params: {
  workspaceId: UUID;
  today: string;
  period: ParticipationReportPeriod;
  courseIds: UUID[];
}): Promise<ApiResult<number>> {
  const dashboard = await getAttendanceDashboard({
    workspaceId: params.workspaceId,
    selectedDate: params.today,
    courseIds: params.courseIds,
  });
  if (!dashboard.ok) return dashboard;
  let count = 0;
  for (const course of dashboard.data.courses) {
    for (const participant of course.participants) {
      for (const session of participant.sessionHistory) {
        if (
          session.status === "missing" &&
          session.date >= params.period.startDate &&
          session.date <= params.period.endDate
        ) {
          count += 1;
        }
      }
    }
  }
  return apiOk(count);
}
