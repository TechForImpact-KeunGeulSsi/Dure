"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import {
  UpsertGeneralScheduleItemSchema,
  type UpsertGeneralScheduleItemInput,
} from "@/lib/validators/schedule";
import type {
  CalendarItem,
  GetCalendarMonthInput,
  GetCalendarMonthOutput,
} from "@/types/calendar";
import type {
  GroupSummary,
  InstructorSummary,
  ISODate,
  ISOTime,
  SessionProgressStatus,
  SessionRollupStatus,
  SessionType,
  SessionVisibilityStatus,
  UUID,
} from "@/types/course";

// ─────────────────────────────────────────────────────────────
// getCalendarMonth — api-spec.md §5.1
// ─────────────────────────────────────────────────────────────

export async function getCalendarMonth(
  input: GetCalendarMonthInput,
): Promise<ApiResult<GetCalendarMonthOutput>> {
  await requireUser();
  const membership = await loadMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 일정 관리 화면을 사용할 수 없습니다.");
  }

  const [timezone, range] = [
    await loadWorkspaceTimezone(input.workspaceId),
    monthRange(input.month),
  ];
  if (!range) {
    return apiError("VALIDATION_FAILED", "잘못된 월 형식입니다.");
  }

  const accessibleGroupIds = await loadAccessibleGroupIds(input.workspaceId);
  const isOwner = membership.role === "owner_admin";

  if (input.groupId) {
    const groupAllowed = await assertCalendarGroupFilterAllowed({
      workspaceId: input.workspaceId,
      groupId: input.groupId,
      isOwner,
      accessibleGroupIds,
    });
    if (!groupAllowed.ok) {
      return groupAllowed as ApiResult<GetCalendarMonthOutput>;
    }
  }

  const [sessionItems, generalItems] = await Promise.all([
    loadCourseSessionItems({
      workspaceId: input.workspaceId,
      startDate: range.startInclusive,
      endDate: range.endExclusive,
      isOwner,
      memberId: membership.memberId,
      accessibleGroupIds,
      groupId: input.groupId,
    }),
    loadGeneralScheduleItems({
      workspaceId: input.workspaceId,
      startDate: range.startInclusive,
      endDate: range.endExclusive,
      isOwner,
      memberId: membership.memberId,
      groupId: input.groupId,
    }),
  ]);

  const items: CalendarItem[] = [...sessionItems, ...generalItems];
  return apiOk({ timezone, items });
}

// ─────────────────────────────────────────────────────────────
// upsertGeneralScheduleItem — api-spec.md §5.2
// ─────────────────────────────────────────────────────────────

export async function upsertGeneralScheduleItem(
  workspaceId: UUID,
  rawInput: UpsertGeneralScheduleItemInput,
): Promise<ApiResult<{ id: UUID }>> {
  const parsed = UpsertGeneralScheduleItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }
  const input = parsed.data;

  await requireUser();
  const membership = await loadMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 일정을 등록할 수 없습니다.");
  }

  // 그룹 검증: 모두 워크스페이스 활성 그룹 + group_admin이면 접근 범위 안
  const admin = createSupabaseAdminClient();
  const { data: groupRows, error: groupLookupError } = await admin
    .from("groups")
    .select("id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .in("id", input.groupIds);
  if (groupLookupError) {
    return apiError("INTERNAL_ERROR", groupLookupError.message);
  }
  const foundGroupIds = new Set((groupRows ?? []).map((row) => row.id as UUID));
  if (foundGroupIds.size !== input.groupIds.length) {
    return apiError("VALIDATION_FAILED", "선택한 그룹 중 일부를 찾을 수 없습니다.");
  }
  if (membership.role === "group_admin") {
    const accessible = await loadAccessibleGroupIds(workspaceId);
    if (!input.groupIds.every((id) => accessible.has(id))) {
      return apiError(
        "SCOPE_FORBIDDEN",
        "접근 권한이 있는 그룹에만 일정을 배정할 수 있습니다.",
      );
    }
  }

  const startsAt = normalizeTime(input.startsAt ?? null);
  const endsAt = normalizeTime(input.endsAt ?? null);

  const now = new Date().toISOString();

  if (input.id) {
    // UPDATE 분기
    const { data: existing, error: existingError } = await admin
      .from("general_schedule_items")
      .select("id, workspace_id, created_by")
      .eq("id", input.id)
      .maybeSingle();
    if (existingError) {
      return apiError("INTERNAL_ERROR", existingError.message);
    }
    if (!existing || existing.workspace_id !== workspaceId) {
      return apiError("NOT_FOUND", "일정을 찾을 수 없습니다.");
    }
    const isCreator = existing.created_by === membership.memberId;
    if (!isOwner(membership) && !isCreator) {
      return apiError("SCOPE_FORBIDDEN", "이 일정을 수정할 권한이 없습니다.");
    }

    const { error: updateError } = await admin
      .from("general_schedule_items")
      .update({
        title: input.title,
        date: input.date,
        starts_at: startsAt,
        ends_at: endsAt,
        description: input.description ?? null,
        color: input.color ?? null,
        updated_at: now,
      })
      .eq("id", input.id)
      .eq("workspace_id", workspaceId);
    if (updateError) {
      return apiError("INTERNAL_ERROR", updateError.message);
    }

    // 그룹 동기화: delete-then-insert
    const { error: groupDeleteError } = await admin
      .from("general_schedule_item_groups")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("schedule_item_id", input.id);
    if (groupDeleteError) {
      return apiError("INTERNAL_ERROR", groupDeleteError.message);
    }
    const groupRowsToInsert = input.groupIds.map((groupId) => ({
      workspace_id: workspaceId,
      schedule_item_id: input.id!,
      group_id: groupId,
    }));
    const { error: groupInsertError } = await admin
      .from("general_schedule_item_groups")
      .insert(groupRowsToInsert);
    if (groupInsertError) {
      return apiError("INTERNAL_ERROR", groupInsertError.message);
    }

    revalidatePath(`/workspaces/${workspaceId}/calendar`);
    return apiOk({ id: input.id });
  }

  // INSERT 분기
  const { data: inserted, error: insertError } = await admin
    .from("general_schedule_items")
    .insert({
      workspace_id: workspaceId,
      title: input.title,
      date: input.date,
      starts_at: startsAt,
      ends_at: endsAt,
      description: input.description ?? null,
      color: input.color ?? null,
      created_by: membership.memberId,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return apiError(
      "INTERNAL_ERROR",
      insertError?.message ?? "일정을 만들지 못했습니다.",
    );
  }
  const newId: UUID = inserted.id;

  const insertRows = input.groupIds.map((groupId) => ({
    workspace_id: workspaceId,
    schedule_item_id: newId,
    group_id: groupId,
  }));
  const { error: groupInsertError } = await admin
    .from("general_schedule_item_groups")
    .insert(insertRows);
  if (groupInsertError) {
    // best-effort 롤백
    await admin.from("general_schedule_items").delete().eq("id", newId);
    return apiError("INTERNAL_ERROR", groupInsertError.message);
  }

  revalidatePath(`/workspaces/${workspaceId}/calendar`);
  return apiOk({ id: newId });
}

// ─────────────────────────────────────────────────────────────
// deleteGeneralScheduleItem — api-spec.md §5.2
// ─────────────────────────────────────────────────────────────

export async function deleteGeneralScheduleItem(
  workspaceId: UUID,
  id: UUID,
): Promise<ApiResult<void>> {
  await requireUser();
  const membership = await loadMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 일정을 삭제할 수 없습니다.");
  }

  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("general_schedule_items")
    .select("id, workspace_id, created_by")
    .eq("id", id)
    .maybeSingle();
  if (existingError) {
    return apiError("INTERNAL_ERROR", existingError.message);
  }
  if (!existing || existing.workspace_id !== workspaceId) {
    return apiError("NOT_FOUND", "일정을 찾을 수 없습니다.");
  }
  const isCreator = existing.created_by === membership.memberId;
  if (!isOwner(membership) && !isCreator) {
    return apiError("SCOPE_FORBIDDEN", "이 일정을 삭제할 권한이 없습니다.");
  }

  // FK cascade로 general_schedule_item_groups도 자동 정리됨.
  const { error: deleteError } = await admin
    .from("general_schedule_items")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (deleteError) {
    return apiError("INTERNAL_ERROR", deleteError.message);
  }

  revalidatePath(`/workspaces/${workspaceId}/calendar`);
  return apiOk(undefined as never);
}

// ─────────────────────────────────────────────────────────────
// internal helpers
// ─────────────────────────────────────────────────────────────

type Membership = {
  memberId: UUID;
  role: "owner_admin" | "group_admin" | "instructor";
};

function isOwner(membership: Membership): boolean {
  return membership.role === "owner_admin";
}

async function loadMembership(workspaceId: UUID): Promise<Membership | null> {
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

async function loadWorkspaceTimezone(workspaceId: UUID): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workspaces")
    .select("timezone")
    .eq("id", workspaceId)
    .maybeSingle();
  return data?.timezone ?? "Asia/Seoul";
}

async function loadAccessibleGroupIds(
  workspaceId: UUID,
): Promise<Set<UUID>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("accessible_group_ids", {
    target_workspace_id: workspaceId,
  });
  const ids: UUID[] = Array.isArray(data)
    ? (data as Array<string | { accessible_group_ids: string }>).map((row) =>
        typeof row === "string" ? row : row.accessible_group_ids ?? "",
      )
    : [];
  return new Set(ids.filter((id) => id.length > 0));
}

async function assertCalendarGroupFilterAllowed(params: {
  workspaceId: UUID;
  groupId: UUID;
  isOwner: boolean;
  accessibleGroupIds: Set<UUID>;
}): Promise<ApiResult<void>> {
  if (!params.isOwner && !params.accessibleGroupIds.has(params.groupId)) {
    return apiError(
      "SCOPE_FORBIDDEN",
      "선택한 그룹에 대한 접근 권한이 없습니다.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("groups")
    .select("id")
    .eq("workspace_id", params.workspaceId)
    .eq("id", params.groupId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    return apiError("INTERNAL_ERROR", error.message);
  }
  if (!data) {
    return apiError("VALIDATION_FAILED", "선택한 그룹을 찾을 수 없습니다.");
  }
  return apiOk(undefined as never);
}

function monthRange(
  month: string,
): { startInclusive: string; endExclusive: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const monthNum = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || monthNum < 1 || monthNum > 12) return null;
  const start = `${month}-01`;
  const nextYear = monthNum === 12 ? year + 1 : year;
  const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { startInclusive: start, endExclusive: end };
}

function normalizeTime(value: string | null): string | null {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
}

// ─────────────────────────────────────────────────────────────
// course_session loader
// ─────────────────────────────────────────────────────────────

type CourseSessionRow = {
  id: UUID;
  course_id: UUID;
  session_no: number;
  date: ISODate;
  starts_at: ISOTime;
  ends_at: ISOTime;
  type: SessionType;
  visibility_status: SessionVisibilityStatus;
  rollup_status: SessionRollupStatus;
  progress_status: SessionProgressStatus;
  course: {
    id: UUID;
    name: string;
    instructor_member_id: UUID | null;
  } | null;
};

async function loadCourseSessionItems(params: {
  workspaceId: UUID;
  startDate: string;
  endDate: string;
  isOwner: boolean;
  memberId: UUID;
  accessibleGroupIds: Set<UUID>;
  groupId?: UUID;
}): Promise<CalendarItem[]> {
  const admin = createSupabaseAdminClient();

  let filteredCourseIds: UUID[] | null = null;
  if (params.groupId) {
    const { data: courseGroupRows, error: courseGroupError } = await admin
      .from("course_groups")
      .select("course_id")
      .eq("workspace_id", params.workspaceId)
      .eq("group_id", params.groupId);
    if (courseGroupError) {
      return [];
    }
    filteredCourseIds = Array.from(
      new Set((courseGroupRows ?? []).map((row) => row.course_id as UUID)),
    );
    if (filteredCourseIds.length === 0) {
      return [];
    }
  }

  let sessionQuery = admin
    .from("course_sessions")
    .select(
      `id, course_id, session_no, date, starts_at, ends_at, type,
       visibility_status, rollup_status, progress_status,
       course:courses!inner(id, name, instructor_member_id)`,
    )
    .eq("workspace_id", params.workspaceId)
    .gte("date", params.startDate)
    .lt("date", params.endDate);
  if (filteredCourseIds) {
    sessionQuery = sessionQuery.in("course_id", filteredCourseIds);
  }

  const { data: sessionRows, error } = await sessionQuery
    .order("date", { ascending: true })
    .order("starts_at", { ascending: true });
  if (error || !sessionRows) {
    return [];
  }

  const sessions = sessionRows as unknown as CourseSessionRow[];
  const courseIds = Array.from(new Set(sessions.map((row) => row.course_id)));
  if (courseIds.length === 0) return [];

  // 수업별 연결 그룹
  const { data: courseGroupRows } = await admin
    .from("course_groups")
    .select("course_id, group:groups(id, name, description, status, deleted_at)")
    .eq("workspace_id", params.workspaceId)
    .in("course_id", courseIds);

  const groupsByCourse = new Map<UUID, GroupSummary[]>();
  for (const row of courseGroupRows ?? []) {
    const g = row.group as unknown as
      | {
          id: UUID;
          name: string;
          description: string | null;
          status: GroupSummary["status"];
          deleted_at: string | null;
        }
      | null;
    if (!g || g.deleted_at) continue;
    const list = groupsByCourse.get(row.course_id as UUID) ?? [];
    list.push({
      id: g.id,
      name: g.name,
      description: g.description,
      status: g.status,
    });
    groupsByCourse.set(row.course_id as UUID, list);
  }

  // instructor 멤버 정보
  const instructorIds = Array.from(
    new Set(
      sessions
        .map((row) => row.course?.instructor_member_id ?? null)
        .filter((id): id is UUID => id != null),
    ),
  );
  const instructorMap = new Map<UUID, InstructorSummary>();
  if (instructorIds.length > 0) {
    const { data: instructorRows } = await admin
      .from("workspace_members")
      .select("id, email, display_name, status")
      .eq("workspace_id", params.workspaceId)
      .in("id", instructorIds);
    for (const row of instructorRows ?? []) {
      instructorMap.set(row.id as UUID, {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        status: row.status,
      });
    }
  }

  const items: CalendarItem[] = [];
  for (const row of sessions) {
    if (!row.course) continue;
    const groups = groupsByCourse.get(row.course_id) ?? [];

    // group_admin 권한 필터 — 수업 연결 그룹 중 하나라도 본인 접근 범위면 노출
    if (!params.isOwner) {
      const overlap = groups.some((g) => params.accessibleGroupIds.has(g.id));
      if (!overlap) continue;
    }

    if (params.groupId && !groups.some((g) => g.id === params.groupId)) {
      continue;
    }

    const allInAccess = params.isOwner
      ? true
      : groups.every((g) => params.accessibleGroupIds.has(g.id));

    items.push({
      kind: "course_session",
      session: {
        id: row.id,
        courseId: row.course_id,
        courseName: row.course.name,
        sessionNo: row.session_no,
        date: row.date,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        type: row.type,
        visibilityStatus: row.visibility_status,
        rollupStatus: row.rollup_status,
        progressStatus: row.progress_status,
        cancellationReason: null,
      },
      instructor: row.course.instructor_member_id
        ? instructorMap.get(row.course.instructor_member_id) ?? null
        : null,
      groups,
      canUpdateSessionDisplay: params.isOwner || allInAccess,
    });
  }
  return items;
}

// ─────────────────────────────────────────────────────────────
// general_schedule_item loader
// ─────────────────────────────────────────────────────────────

type GeneralScheduleRow = {
  id: UUID;
  title: string;
  date: ISODate;
  starts_at: ISOTime | null;
  ends_at: ISOTime | null;
  description: string | null;
  color: string | null;
  created_by: UUID | null;
  groups: Array<{
    group: {
      id: UUID;
      name: string;
      description: string | null;
      status: GroupSummary["status"];
      deleted_at: string | null;
    } | null;
  }>;
};

async function loadGeneralScheduleItems(params: {
  workspaceId: UUID;
  startDate: string;
  endDate: string;
  isOwner: boolean;
  memberId: UUID;
  groupId?: UUID;
}): Promise<CalendarItem[]> {
  // RLS가 owner_admin / 접근 그룹 매핑 기반으로 자동 필터해주므로
  // 일반 server client로 SELECT.
  const supabase = await createSupabaseServerClient();

  let scheduleItemIds: UUID[] | null = null;
  if (params.groupId) {
    const admin = createSupabaseAdminClient();
    const { data: linkRows, error: linkError } = await admin
      .from("general_schedule_item_groups")
      .select("schedule_item_id")
      .eq("workspace_id", params.workspaceId)
      .eq("group_id", params.groupId);
    if (linkError) {
      return [];
    }
    scheduleItemIds = Array.from(
      new Set((linkRows ?? []).map((row) => row.schedule_item_id as UUID)),
    );
    if (scheduleItemIds.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from("general_schedule_items")
    .select(
      `id, title, date, starts_at, ends_at, description, color, created_by,
       groups:general_schedule_item_groups(
         group:groups(id, name, description, status, deleted_at)
       )`,
    )
    .eq("workspace_id", params.workspaceId)
    .gte("date", params.startDate)
    .lt("date", params.endDate);
  if (scheduleItemIds) {
    query = query.in("id", scheduleItemIds);
  }

  const { data, error } = await query
    .order("date", { ascending: true })
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (error || !data) return [];

  const rows = data as unknown as GeneralScheduleRow[];
  const items: CalendarItem[] = [];
  for (const row of rows) {
    const groups: GroupSummary[] = [];
    for (const link of row.groups ?? []) {
      const g = link.group;
      if (!g || g.deleted_at) continue;
      groups.push({
        id: g.id,
        name: g.name,
        description: g.description,
        status: g.status,
      });
    }
    if (params.groupId && !groups.some((g) => g.id === params.groupId)) {
      continue;
    }
    const isCreator = row.created_by === params.memberId;
    const canModify = params.isOwner || isCreator;
    items.push({
      kind: "general_schedule_item",
      item: {
        id: row.id,
        title: row.title,
        date: row.date,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        description: row.description,
        color: row.color,
        groups,
        canEdit: canModify,
        canDelete: canModify,
      },
    });
  }
  return items;
}

function collectFieldErrors(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    (result[path] ??= []).push(issue.message);
  }
  return result;
}
