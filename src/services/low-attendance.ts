"use server";

import "server-only";

import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { UUID } from "@/lib/api/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadCurrentMembership } from "@/services/access";
import { filterCoursesByRole, getAttendanceDashboard } from "@/services/attendance-dashboard";

import { buildMonthlyLowAttendance, type MonthlyLowAttendanceRow } from "./low-attendance-logic";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export type ContactResult = "reached" | "no_answer" | "other";

export type LowAttendanceListRow = MonthlyLowAttendanceRow & {
  contact: { result: ContactResult; note: string | null; updatedAt: string } | null;
};

export type LowAttendanceListOutput = {
  month: string;
  rows: LowAttendanceListRow[];
};

const GetSchema = z.object({
  workspaceId: z.string().uuid(),
  month: z.string().regex(MONTH),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function getLowAttendanceList(
  rawInput: z.infer<typeof GetSchema>,
): Promise<ApiResult<LowAttendanceListOutput>> {
  const parsed = GetSchema.safeParse(rawInput);
  if (!parsed.success) return apiError("VALIDATION_FAILED", "조회 조건을 확인해 주세요.");
  const workspaceId = parsed.data.workspaceId as UUID;

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "저출석자 목록을 볼 권한이 없습니다.");
  }

  // 대시보드 조회가 역할별 수업 범위와 참여자 배정 규칙을 그대로 적용한다.
  const dashboard = await getAttendanceDashboard({
    workspaceId,
    selectedDate: parsed.data.today,
  });
  if (!dashboard.ok) return dashboard;

  const rows = buildMonthlyLowAttendance(dashboard.data.courses, parsed.data.month);
  if (rows.length === 0) return apiOk({ month: parsed.data.month, rows: [] });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("attendance_contact_notes")
    .select("course_id, participant_id, result, note, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("month", `${parsed.data.month}-01`)
    .in("course_id", Array.from(new Set(rows.map((row) => row.courseId))));
  if (error) return apiError("INTERNAL_ERROR", error.message);
  const noteByKey = new Map(
    (data ?? []).map((row) => [
      `${row.course_id}:${row.participant_id}`,
      {
        result: row.result as ContactResult,
        note: (row.note as string | null) ?? null,
        updatedAt: row.updated_at as string,
      },
    ]),
  );

  return apiOk({
    month: parsed.data.month,
    rows: rows.map((row) => ({
      ...row,
      contact: noteByKey.get(`${row.courseId}:${row.participantId}`) ?? null,
    })),
  });
}

const SaveSchema = z.object({
  workspaceId: z.string().uuid(),
  courseId: z.string().uuid(),
  participantId: z.string().uuid(),
  month: z.string().regex(MONTH),
  result: z.enum(["reached", "no_answer", "other"]),
  note: z.string().trim().max(500).optional(),
});

export async function saveAttendanceContactNote(
  rawInput: z.infer<typeof SaveSchema>,
): Promise<ApiResult<{ updatedAt: string }>> {
  const parsed = SaveSchema.safeParse(rawInput);
  if (!parsed.success) return apiError("VALIDATION_FAILED", "연락 결과를 확인해 주세요. 메모는 500자까지입니다.");
  const input = parsed.data;
  const workspaceId = input.workspaceId as UUID;

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "연락 결과를 저장할 권한이 없습니다.");
  }

  const admin = createSupabaseAdminClient();
  const { data: course, error: courseError } = await admin
    .from("courses")
    .select("id, name, status, starts_on, instructor_member_id")
    .eq("workspace_id", workspaceId)
    .eq("id", input.courseId)
    .maybeSingle();
  if (courseError) return apiError("INTERNAL_ERROR", courseError.message);
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const scoped = await filterCoursesByRole({ workspaceId, membership, courses: [course] });
  if (!scoped.ok) return scoped;
  if (scoped.data.length === 0) return apiError("SCOPE_FORBIDDEN", "이 수업의 연락 결과를 저장할 수 없습니다.");

  const { data: participant, error: participantError } = await admin
    .from("participants")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", input.participantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (participantError) return apiError("INTERNAL_ERROR", participantError.message);
  if (!participant) return apiError("NOT_FOUND", "참여자를 찾을 수 없습니다.");

  const { data, error } = await admin
    .from("attendance_contact_notes")
    .upsert(
      {
        workspace_id: workspaceId,
        course_id: input.courseId,
        participant_id: input.participantId,
        month: `${input.month}-01`,
        result: input.result,
        note: input.note ? input.note : null,
        updated_by: membership.memberId,
      },
      { onConflict: "course_id,participant_id,month" },
    )
    .select("updated_at")
    .single();
  if (error) return apiError("INTERNAL_ERROR", error.message);
  return apiOk({ updatedAt: data.updated_at as string });
}
