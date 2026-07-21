import "server-only";

import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { UUID } from "@/lib/api/types";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadCurrentMembership } from "@/services/access";

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
  const [workspaceResult, coursesResult, sessionsResult, materialsResult, feedbacksResult, participantsResult] =
    await Promise.all([
      admin
        .from("workspaces")
        .select("timezone")
        .eq("id", input.workspaceId)
        .maybeSingle(),
      admin
        .from("courses")
        .select("id, name, status")
        .eq("workspace_id", input.workspaceId),
      admin
        .from("course_sessions")
        .select(
          "id, course_id, session_no, date, starts_at, ends_at, visibility_status, rollup_status, progress_status",
        )
        .eq("workspace_id", input.workspaceId),
      admin
        .from("materials")
        .select("id, course_id, title, created_at, updated_at")
        .eq("workspace_id", input.workspaceId)
        .eq("upload_status", "uploaded")
        .eq("review_status", "pending")
        .order("created_at", { ascending: true }),
      admin
        .from("course_feedbacks")
        .select(
          "id, course_id, course_name_snapshot, category, message, created_at",
        )
        .eq("workspace_id", input.workspaceId)
        .eq("status", "new")
        .order("created_at", { ascending: true }),
      admin
        .from("course_participants")
        .select("course_id, participant_id")
        .eq("workspace_id", input.workspaceId)
        .eq("status", "active"),
    ]);

  const firstError = [
    workspaceResult.error,
    coursesResult.error,
    sessionsResult.error,
    materialsResult.error,
    feedbacksResult.error,
    participantsResult.error,
  ].find(Boolean);
  if (firstError) {
    return apiError("INTERNAL_ERROR", firstError.message);
  }
  if (!workspaceResult.data) {
    return apiError("NOT_FOUND", "워크스페이스를 찾을 수 없습니다.");
  }

  const sessions = (sessionsResult.data ?? []) as AdminCopilotSessionRow[];
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
        courses: (coursesResult.data ?? []) as AdminCopilotCourseRow[],
        sessions,
        materials: (materialsResult.data ?? []) as AdminCopilotMaterialRow[],
        feedbacks: (feedbacksResult.data ?? []) as AdminCopilotFeedbackRow[],
        attendanceRecords: attendanceResult.data,
        activeParticipantCourses: (participantsResult.data ?? []) as AdminCopilotParticipantCourseRow[],
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

async function loadAttendanceRecords(
  workspaceId: UUID,
  sessionIds: UUID[],
): Promise<ApiResult<AdminCopilotAttendanceRow[]>> {
  if (sessionIds.length === 0) return apiOk([]);

  const admin = createSupabaseAdminClient();
  const chunks = chunk(sessionIds, ATTENDANCE_QUERY_CHUNK_SIZE);
  const records: AdminCopilotAttendanceRow[] = [];
  for (const ids of chunks) {
    const { data, error } = await admin
      .from("attendance_records")
      .select(
        "id, session_id, participant_id, participant_name_snapshot, status, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .in("session_id", ids);
    if (error) return apiError("INTERNAL_ERROR", error.message);
    records.push(...((data ?? []) as AdminCopilotAttendanceRow[]));
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
