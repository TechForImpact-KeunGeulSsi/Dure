import "server-only";

import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { UUID } from "@/lib/api/types";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadCurrentMembership } from "@/services/access";

import {
  deriveAdminCopilotParticipantCourses,
  loadAllAdminCopilotRows,
  type AdminCopilotCourseGroupRow,
  type AdminCopilotGroupRow,
  type AdminCopilotParticipantCourseStatusRow,
  type AdminCopilotParticipantGroupRow,
  type AdminCopilotParticipantRow,
} from "./admin-copilot-participant-projection";
import {
  buildAdminCopilotBriefing,
  getAdminCopilotRoleError,
  type AdminCopilotAttendanceRow,
  type AdminCopilotBriefing,
  type AdminCopilotCourseRow,
  type AdminCopilotFeedbackRow,
  type AdminCopilotMaterialRow,
  type AdminCopilotParticipantCourseRow,
  type AdminCopilotSessionRow,
} from "./admin-copilot-logic";

export type {
  AdminCopilotBriefing,
  AdminCopilotEvidence,
  AdminCopilotEvidenceEntityType,
  AdminCopilotTask,
  AdminCopilotTaskPriority,
  AdminCopilotTaskType,
} from "./admin-copilot-logic";

export type GetAdminCopilotBriefingInput = {
  workspaceId: UUID;
  referenceDate?: string;
};

const ATTENDANCE_QUERY_CHUNK_SIZE = 150;

export async function getAdminCopilotBriefing(
  input: GetAdminCopilotBriefingInput,
): Promise<ApiResult<AdminCopilotBriefing>> {
  await requireUser();

  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }

  if (getAdminCopilotRoleError(membership.role)) {
    return apiError(
      "ROLE_FORBIDDEN",
      "운영 브리핑은 대표 운영자만 확인할 수 있습니다.",
    );
  }

  const admin = createSupabaseAdminClient();
  const [
    workspaceResult,
    coursesResult,
    sessionsResult,
    materialsResult,
    feedbacksResult,
    participantProjectionResult,
  ] = await Promise.all([
    admin
      .from("workspaces")
      .select("timezone")
      .eq("id", input.workspaceId)
      .maybeSingle(),
    loadAllAdminCopilotRows<AdminCopilotCourseRow>((from, to) =>
      admin
        .from("courses")
        .select("id, name, status")
        .eq("workspace_id", input.workspaceId)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    loadAllAdminCopilotRows<AdminCopilotSessionRow>((from, to) =>
      admin
        .from("course_sessions")
        .select(
          "id, course_id, session_no, date, starts_at, ends_at, visibility_status, rollup_status, progress_status",
        )
        .eq("workspace_id", input.workspaceId)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    loadAllAdminCopilotRows<AdminCopilotMaterialRow>((from, to) =>
      admin
        .from("materials")
        .select("id, course_id, title, created_at, updated_at")
        .eq("workspace_id", input.workspaceId)
        .eq("upload_status", "uploaded")
        .eq("review_status", "pending")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    loadAllAdminCopilotRows<AdminCopilotFeedbackRow>((from, to) =>
      admin
        .from("course_feedbacks")
        .select(
          "id, course_id, course_name_snapshot, category, message, created_at",
        )
        .eq("workspace_id", input.workspaceId)
        .eq("status", "new")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    loadActiveParticipantCourses(input.workspaceId),
  ]);

  const firstError = [
    workspaceResult.error,
    coursesResult.error,
    sessionsResult.error,
    materialsResult.error,
    feedbacksResult.error,
  ].find(Boolean);
  if (firstError) {
    return apiError("INTERNAL_ERROR", firstError.message);
  }
  if (!workspaceResult.data) {
    return apiError("NOT_FOUND", "워크스페이스를 찾을 수 없습니다.");
  }
  if (!participantProjectionResult.ok) return participantProjectionResult;

  const sessions = sessionsResult.data;
  const attendanceSessionIds = sessions
    .filter(
      (session) =>
        session.rollup_status === "included" &&
        session.progress_status !== "cancelled",
    )
    .map((session) => session.id);
  const attendanceResult = await loadAttendanceRecords(
    input.workspaceId,
    attendanceSessionIds,
  );
  if (!attendanceResult.ok) return attendanceResult;

  try {
    return apiOk(
      buildAdminCopilotBriefing({
        workspaceId: input.workspaceId,
        timezone: workspaceResult.data.timezone ?? "Asia/Seoul",
        referenceDate: input.referenceDate,
        courses: coursesResult.data,
        sessions,
        materials: materialsResult.data,
        feedbacks: feedbacksResult.data,
        attendanceRecords: attendanceResult.data,
        activeParticipantCourses: participantProjectionResult.data,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_REFERENCE_DATE") {
      return apiError(
        "VALIDATION_FAILED",
        "기준 날짜는 유효한 ISO 날짜 또는 날짜·시간이어야 합니다.",
      );
    }
    return apiError(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "운영 브리핑을 만들지 못했습니다.",
    );
  }
}

async function loadActiveParticipantCourses(
  workspaceId: UUID,
): Promise<ApiResult<AdminCopilotParticipantCourseRow[]>> {
  const admin = createSupabaseAdminClient();
  const [courseGroups, groups, participantGroups, participants, participantCourses] =
    await Promise.all([
      loadAllAdminCopilotRows<AdminCopilotCourseGroupRow>((from, to) =>
        admin
          .from("course_groups")
          .select("course_id, group_id")
          .eq("workspace_id", workspaceId)
          .order("id", { ascending: true })
          .range(from, to),
      ),
      loadAllAdminCopilotRows<AdminCopilotGroupRow>((from, to) =>
        admin
          .from("groups")
          .select("id, deleted_at")
          .eq("workspace_id", workspaceId)
          .is("deleted_at", null)
          .order("id", { ascending: true })
          .range(from, to),
      ),
      loadAllAdminCopilotRows<AdminCopilotParticipantGroupRow>((from, to) =>
        admin
          .from("participant_groups")
          .select("participant_id, group_id, status")
          .eq("workspace_id", workspaceId)
          .eq("status", "active")
          .order("id", { ascending: true })
          .range(from, to),
      ),
      loadAllAdminCopilotRows<AdminCopilotParticipantRow>((from, to) =>
        admin
          .from("participants")
          .select("id, status, deleted_at")
          .eq("workspace_id", workspaceId)
          .is("deleted_at", null)
          .neq("status", "deleted")
          .order("id", { ascending: true })
          .range(from, to),
      ),
      loadAllAdminCopilotRows<AdminCopilotParticipantCourseStatusRow>(
        (from, to) =>
          admin
            .from("course_participants")
            .select("course_id, participant_id, status")
            .eq("workspace_id", workspaceId)
            .eq("status", "excluded")
            .order("id", { ascending: true })
            .range(from, to),
      ),
    ]);

  const firstError = [
    courseGroups.error,
    groups.error,
    participantGroups.error,
    participants.error,
    participantCourses.error,
  ].find(Boolean);
  if (firstError) return apiError("INTERNAL_ERROR", firstError.message);

  return apiOk(
    deriveAdminCopilotParticipantCourses({
      courseGroups: courseGroups.data,
      groups: groups.data,
      participantGroups: participantGroups.data,
      participants: participants.data,
      participantCourses: participantCourses.data,
    }),
  );
}

async function loadAttendanceRecords(
  workspaceId: UUID,
  sessionIds: UUID[],
): Promise<ApiResult<AdminCopilotAttendanceRow[]>> {
  if (sessionIds.length === 0) return apiOk([]);

  const admin = createSupabaseAdminClient();
  const chunks = chunk(sessionIds, ATTENDANCE_QUERY_CHUNK_SIZE);
  const records: AdminCopilotAttendanceRow[] = [];
  for (const ids of chunks) {
    const result = await loadAllAdminCopilotRows<AdminCopilotAttendanceRow>((from, to) =>
      admin
        .from("attendance_records")
        .select(
          "id, session_id, participant_id, participant_name_snapshot, status, updated_at",
        )
        .eq("workspace_id", workspaceId)
        .in("session_id", ids)
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (result.error) return apiError("INTERNAL_ERROR", result.error.message);
    records.push(...result.data);
  }

  return apiOk(records);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
