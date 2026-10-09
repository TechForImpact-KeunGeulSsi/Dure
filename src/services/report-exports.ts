"use server";

import "server-only";

import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { UUID } from "@/lib/api/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadCurrentMembership } from "@/services/access";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const RecordSchema = z.object({
  workspaceId: z.string().uuid(),
  format: z.enum(["xlsx", "print"]),
  periodLabel: z.string().trim().min(1).max(40),
  startDate: z.string().regex(DATE),
  endDate: z.string().regex(DATE),
  filters: z.object({
    courseId: z.string().uuid().nullable(),
    gender: z.enum(["female", "male"]).nullable(),
    disability: z.enum(["yes", "no"]).nullable(),
    ageBand: z.string().regex(/^\d{1,3}$/).nullable(),
  }),
  options: z.object({
    nameMode: z.enum(["masked", "none"]),
    includeGender: z.boolean(),
    includeAgeBand: z.boolean(),
    includeDisability: z.boolean(),
  }),
  participantRowCount: z.number().int().min(0).max(1_000_000),
});

export type RecordReportExportInput = z.infer<typeof RecordSchema>;

export type ReportExportItem = {
  id: UUID;
  format: "xlsx" | "print";
  periodLabel: string;
  createdAt: string;
  createdByName: string | null;
  participantRowCount: number;
  options: RecordReportExportInput["options"];
};

// 제출 파일을 만들 때마다 한 줄 남긴다. 운영자만 기록할 수 있다.
export async function recordReportExport(
  rawInput: RecordReportExportInput,
): Promise<ApiResult<{ id: UUID }>> {
  const parsed = RecordSchema.safeParse(rawInput);
  if (!parsed.success || parsed.data.startDate > parsed.data.endDate) {
    return apiError("VALIDATION_FAILED", "제출 파일 기록 정보를 확인해 주세요.");
  }
  const input = parsed.data;
  const workspaceId = input.workspaceId as UUID;

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "제출 파일을 만들 권한이 없습니다.");
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("report_exports")
    .insert({
      workspace_id: workspaceId,
      created_by: membership.memberId,
      format: input.format,
      period_label: input.periodLabel,
      start_date: input.startDate,
      end_date: input.endDate,
      filters: input.filters,
      options: input.options,
      participant_row_count: input.participantRowCount,
    })
    .select("id")
    .single();
  if (error) return apiError("INTERNAL_ERROR", error.message);
  return apiOk({ id: data.id as UUID });
}

// 최근 제출 파일 이력. 대표 운영자는 전체, 그룹 운영자는 자기가 만든 것만 본다.
export async function listReportExports(
  workspaceIdRaw: string,
): Promise<ApiResult<ReportExportItem[]>> {
  const parsed = z.string().uuid().safeParse(workspaceIdRaw);
  if (!parsed.success) return apiError("VALIDATION_FAILED", "워크스페이스를 확인해 주세요.");
  const workspaceId = parsed.data as UUID;

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "제출 파일 이력을 볼 권한이 없습니다.");
  }

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("report_exports")
    .select("id, format, period_label, created_at, created_by, participant_row_count, options")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (membership.role !== "owner_admin") query = query.eq("created_by", membership.memberId);
  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const memberIds = Array.from(
    new Set((data ?? []).map((row) => row.created_by as UUID | null).filter((id): id is UUID => Boolean(id))),
  );
  const names = new Map<UUID, string>();
  if (memberIds.length > 0) {
    const { data: members, error: memberError } = await admin
      .from("workspace_members")
      .select("id, display_name, email")
      .eq("workspace_id", workspaceId)
      .in("id", memberIds);
    if (memberError) return apiError("INTERNAL_ERROR", memberError.message);
    for (const member of members ?? []) {
      names.set(member.id as UUID, (member.display_name as string | null) ?? (member.email as string));
    }
  }

  return apiOk(
    (data ?? []).map((row) => ({
      id: row.id as UUID,
      format: row.format as "xlsx" | "print",
      periodLabel: row.period_label as string,
      createdAt: row.created_at as string,
      createdByName: row.created_by ? (names.get(row.created_by as UUID) ?? null) : null,
      participantRowCount: row.participant_row_count as number,
      options: row.options as RecordReportExportInput["options"],
    })),
  );
}
