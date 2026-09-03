import "server-only";

import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  AttendanceStatus,
  CourseParticipantStatus,
  CourseStatus,
  UUID,
} from "@/lib/api/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCurrentMembership } from "@/services/access";

import {
  buildAttendanceDashboard,
  type AttendanceDashboardOutput,
  type AttendanceDashboardParticipantInput,
  type AttendanceDashboardRecordInput,
  type AttendanceDashboardSessionInput,
} from "./attendance-dashboard-logic";

const GetAttendanceDashboardSchema = z.object({
  workspaceId: z.string().uuid(),
  selectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  courseIds: z.array(z.string().uuid()).max(100).optional(),
});

export type GetAttendanceDashboardInput = z.infer<
  typeof GetAttendanceDashboardSchema
>;

export async function getAttendanceDashboard(
  rawInput: GetAttendanceDashboardInput,
): Promise<ApiResult<AttendanceDashboardOutput>> {
  const parsed = GetAttendanceDashboardSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "대시보드 조회 조건을 확인해 주세요.");
  }

  await requireUser();
  const membership = await loadCurrentMembership(parsed.data.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const admin = createSupabaseAdminClient();
  const { data: courseRows, error: courseError } = await admin
    .from("courses")
    .select("id, name, status, starts_on, instructor_member_id")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("status", "in_progress")
    .order("name", { ascending: true });
  if (courseError) return apiError("INTERNAL_ERROR", courseError.message);

  const roleScopedCourses = await filterCoursesByRole({
    workspaceId: parsed.data.workspaceId,
    membership,
    courses: courseRows ?? [],
  });
  if (!roleScopedCourses.ok) return roleScopedCourses;
  const requestedCourseIds = parsed.data.courseIds;
  const courses = requestedCourseIds
    ? roleScopedCourses.data.filter((course) =>
        requestedCourseIds.includes(course.id as UUID),
      )
    : roleScopedCourses.data;
  const courseIds = courses.map((course) => course.id as UUID);

  if (courseIds.length === 0) {
    return apiOk({
      selectedDate: parsed.data.selectedDate,
      courses: [],
      summary: {
        missingAttendanceCount: 0,
        lowAttendanceParticipantCount: 0,
      },
    });
  }

  const [sessionResult, courseGroupResult, assignmentResult] = await Promise.all([
    admin
      .from("course_sessions")
      .select(
        "id, course_id, session_no, date, starts_at, ends_at, rollup_status, progress_status",
      )
      .eq("workspace_id", parsed.data.workspaceId)
      .in("course_id", courseIds)
      .order("date", { ascending: true })
      .order("starts_at", { ascending: true })
      .order("session_no", { ascending: true }),
    admin
      .from("course_groups")
      .select("course_id, group_id")
      .eq("workspace_id", parsed.data.workspaceId)
      .in("course_id", courseIds),
    admin
      .from("course_participants")
      .select("course_id, participant_id, status, assigned_at")
      .eq("workspace_id", parsed.data.workspaceId)
      .in("course_id", courseIds),
  ]);
  if (sessionResult.error) return apiError("INTERNAL_ERROR", sessionResult.error.message);
  if (courseGroupResult.error) {
    return apiError("INTERNAL_ERROR", courseGroupResult.error.message);
  }
  if (assignmentResult.error) {
    return apiError("INTERNAL_ERROR", assignmentResult.error.message);
  }

  const sessions: AttendanceDashboardSessionInput[] = (sessionResult.data ?? []).map(
    (row) => ({
      id: row.id as UUID,
      courseId: row.course_id as UUID,
      sessionNo: row.session_no as number,
      date: row.date as string,
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
      rollupStatus: row.rollup_status as "included" | "excluded",
      progressStatus: row.progress_status as "scheduled" | "cancelled",
    }),
  );
  const courseGroupRows = (courseGroupResult.data ?? []) as Array<{
    course_id: UUID;
    group_id: UUID;
  }>;
  const groupIds = Array.from(new Set(courseGroupRows.map((row) => row.group_id)));

  const participantGroupRowsResult =
    groupIds.length === 0
      ? apiOk([] as Array<{ participantId: UUID; groupId: UUID }>)
      : await loadParticipantGroups(parsed.data.workspaceId, groupIds);
  if (!participantGroupRowsResult.ok) return participantGroupRowsResult;
  const participantGroupRows = participantGroupRowsResult.data;
  const participantIds = Array.from(
    new Set(participantGroupRows.map((row) => row.participantId)),
  );
  const participantRowsResult =
    participantIds.length === 0
      ? apiOk([] as Array<{ id: UUID; name: string; status: string }>)
      : await loadParticipants(parsed.data.workspaceId, participantIds);
  if (!participantRowsResult.ok) return participantRowsResult;
  const participantRows = participantRowsResult.data;

  const courseIdsByGroup = new Map<UUID, UUID[]>();
  for (const row of courseGroupRows) {
    const current = courseIdsByGroup.get(row.group_id) ?? [];
    current.push(row.course_id);
    courseIdsByGroup.set(row.group_id, current);
  }
  const activeParticipantById = new Map(
    participantRows
      .filter((participant) => participant.status === "active")
      .map((participant) => [participant.id, participant]),
  );
  const assignmentByCourseParticipant = new Map<
    string,
    { status: CourseParticipantStatus; assignedAt: string }
  >();
  for (const row of assignmentResult.data ?? []) {
    assignmentByCourseParticipant.set(
      String(row.course_id) + ":" + String(row.participant_id),
      {
        status: row.status as CourseParticipantStatus,
        assignedAt: row.assigned_at as string,
      },
    );
  }

  const firstSessionDateByCourse = new Map<UUID, string>();
  for (const session of sessions) {
    const current = firstSessionDateByCourse.get(session.courseId);
    if (!current || session.date < current) {
      firstSessionDateByCourse.set(session.courseId, session.date);
    }
  }
  const courseStartById = new Map(
    courses.map((course) => [course.id as UUID, course.starts_on as string | null]),
  );
  const participants: AttendanceDashboardParticipantInput[] = [];
  const seenCourseParticipants = new Set<string>();
  for (const row of participantGroupRows) {
    const participant = activeParticipantById.get(row.participantId);
    if (!participant) continue;
    const linkedCourseIds = courseIdsByGroup.get(row.groupId) ?? [];
    for (const courseId of linkedCourseIds) {
      const key = String(courseId) + ":" + String(row.participantId);
      if (seenCourseParticipants.has(key)) continue;
      seenCourseParticipants.add(key);
      const assignment = assignmentByCourseParticipant.get(key);
      if (assignment?.status === "excluded") continue;
      const fallbackDate =
        courseStartById.get(courseId) ??
        firstSessionDateByCourse.get(courseId) ??
        parsed.data.selectedDate;
      participants.push({
        participantId: row.participantId,
        participantName: participant.name,
        courseId,
        assignedAt: assignment?.assignedAt ?? fallbackDate + "T00:00:00.000Z",
        status: "active",
      });
    }
  }

  const sessionIds = sessions.map((session) => session.id);
  const recordsResult =
    sessionIds.length === 0
      ? apiOk([] as AttendanceDashboardRecordInput[])
      : await loadAttendanceRecords(parsed.data.workspaceId, sessionIds);
  if (!recordsResult.ok) return recordsResult;
  const records = recordsResult.data;
  const timezoneResult = await loadWorkspaceTimezone(parsed.data.workspaceId);
  if (!timezoneResult.ok) return timezoneResult;

  const result = buildAttendanceDashboard({
    selectedDate: parsed.data.selectedDate,
    now: new Date().toISOString(),
    timezone: timezoneResult.data,
    courses: courses.map((course) => ({
      id: course.id as UUID,
      name: course.name as string,
      status: course.status as CourseStatus,
    })),
    sessions,
    participants,
    records,
  });
  return apiOk(result);
}

type ScopedCourseRow = {
  id: UUID;
  name: string;
  status: CourseStatus;
  starts_on: string | null;
  instructor_member_id: UUID | null;
};

async function filterCoursesByRole(params: {
  workspaceId: UUID;
  membership: { memberId: UUID; role: "owner_admin" | "group_admin" | "instructor" };
  courses: Array<{
    id: string;
    name: string;
    status: string;
    starts_on: string | null;
    instructor_member_id: string | null;
  }>;
}): Promise<ApiResult<ScopedCourseRow[]>> {
  const courses = params.courses as ScopedCourseRow[];
  if (params.membership.role === "owner_admin") return apiOk(courses);
  if (params.membership.role === "instructor") {
    return apiOk(
      courses.filter(
        (course) => course.instructor_member_id === params.membership.memberId,
      ),
    );
  }

  const accessibleGroupIdsResult = await loadAccessibleGroupIds(params.workspaceId);
  if (!accessibleGroupIdsResult.ok) return accessibleGroupIdsResult;
  if (accessibleGroupIdsResult.data.size === 0) return apiOk([]);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("course_groups")
    .select("course_id, group_id")
    .eq("workspace_id", params.workspaceId)
    .in("group_id", Array.from(accessibleGroupIdsResult.data));
  if (error) return apiError("INTERNAL_ERROR", error.message);
  const accessibleCourseIds = new Set(
    (data ?? []).map((row) => row.course_id as UUID),
  );
  return apiOk(courses.filter((course) => accessibleCourseIds.has(course.id)));
}

async function loadParticipantGroups(
  workspaceId: UUID,
  groupIds: UUID[],
): Promise<ApiResult<Array<{ participantId: UUID; groupId: UUID }>>> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("participant_groups")
    .select("participant_id, group_id")
    .eq("workspace_id", workspaceId)
    .in("group_id", groupIds)
    .eq("status", "active");
  if (error) return apiError("INTERNAL_ERROR", error.message);
  return apiOk((data ?? []).map((row) => ({
    participantId: row.participant_id as UUID,
    groupId: row.group_id as UUID,
  })));
}

async function loadParticipants(
  workspaceId: UUID,
  participantIds: UUID[],
): Promise<ApiResult<Array<{ id: UUID; name: string; status: string }>>> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("participants")
    .select("id, name, status")
    .eq("workspace_id", workspaceId)
    .in("id", participantIds)
    .is("deleted_at", null);
  if (error) return apiError("INTERNAL_ERROR", error.message);
  return apiOk((data ?? []).map((row) => ({
    id: row.id as UUID,
    name: row.name as string,
    status: row.status as string,
  })));
}

async function loadAttendanceRecords(
  workspaceId: UUID,
  sessionIds: UUID[],
): Promise<ApiResult<AttendanceDashboardRecordInput[]>> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("attendance_records")
    .select("session_id, participant_id, status, note, updated_at")
    .eq("workspace_id", workspaceId)
    .in("session_id", sessionIds)
    .order("updated_at", { ascending: true });
  if (error) return apiError("INTERNAL_ERROR", error.message);
  return apiOk((data ?? []).map((row) => ({
    sessionId: row.session_id as UUID,
    participantId: row.participant_id as UUID,
    status: row.status as AttendanceStatus,
    note: row.note as string | null,
  })));
}

async function loadWorkspaceTimezone(workspaceId: UUID): Promise<ApiResult<string>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("timezone")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) return apiError("INTERNAL_ERROR", error.message);
  return apiOk(data?.timezone ?? "Asia/Seoul");
}

async function loadAccessibleGroupIds(workspaceId: UUID): Promise<ApiResult<Set<UUID>>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accessible_group_ids", {
    target_workspace_id: workspaceId,
  });
  if (error) return apiError("INTERNAL_ERROR", error.message);
  const ids = Array.isArray(data)
    ? (data as Array<string | { accessible_group_ids: string }>).map((row) =>
        typeof row === "string" ? row : row.accessible_group_ids,
      )
    : [];
  return apiOk(new Set(ids.filter((id): id is UUID => Boolean(id))));
}
