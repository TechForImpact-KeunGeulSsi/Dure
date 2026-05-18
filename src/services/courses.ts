"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  CourseListItem,
  CourseStatus,
  GroupSummary,
  InstructorSummary,
  PageInfo,
  ParticipantSummary,
  UUID,
} from "@/lib/api/types";
import { planSessions } from "@/lib/courses/recurrence";
import {
  CreateCourseSchema,
  UpdateCourseParticipantAssignmentSchema,
  UpdateCourseSchema,
  type CreateCourseInput,
  type UpdateCourseInput,
  type UpdateCourseParticipantAssignmentInput,
} from "@/lib/validators/course";

const DEFAULT_PAGE_SIZE = 20;

type GetCoursesPageInput = {
  workspaceId: UUID;
  search?: string;
  groupId?: UUID;
  status?: CourseStatus;
  page?: number;
  pageSize?: number;
};

export type GetCoursesPageOutput = {
  courses: CourseListItem[];
  pageInfo: PageInfo;
};

export async function getCoursesPage(
  input: GetCoursesPageInput,
): Promise<ApiResult<GetCoursesPageOutput>> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  await requireUser();
  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const supabase = await createSupabaseServerClient();

  // groupId 필터링은 course_groups 사전 조회.
  let courseIdFilter: UUID[] | null = null;
  if (input.groupId) {
    const { data: cgRows, error: cgError } = await supabase
      .from("course_groups")
      .select("course_id")
      .eq("workspace_id", input.workspaceId)
      .eq("group_id", input.groupId);
    if (cgError) return apiError("INTERNAL_ERROR", cgError.message);
    courseIdFilter = Array.from(
      new Set((cgRows ?? []).map((row) => row.course_id as UUID)),
    );
    if (courseIdFilter.length === 0) {
      return apiOk({
        courses: [],
        pageInfo: { page, pageSize, totalCount: 0, hasNextPage: false },
      });
    }
  }

  let query = supabase
    .from("courses")
    .select(
      "id, name, status, starts_on, ends_on, card_color, banner_url, instructor_member_id",
      { count: "exact" },
    )
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (input.search && input.search.trim().length > 0) {
    query = query.ilike("name", `%${input.search.trim()}%`);
  }
  if (input.status) {
    query = query.eq("status", input.status);
  }
  if (courseIdFilter) {
    query = query.in("id", courseIdFilter);
  }

  const { data, error, count } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const rows = data ?? [];
  const courseIds = rows.map((row) => row.id as UUID);
  const instructorIds = rows
    .map((row) => row.instructor_member_id as UUID | null)
    .filter((id): id is UUID => id != null);

  const [groupsByCourse, participantCounts, sessionCounts, instructorMap] =
    await Promise.all([
      loadGroupsByCourse(input.workspaceId, courseIds),
      loadParticipantCounts(courseIds),
      loadSessionCounts(courseIds),
      loadInstructors(input.workspaceId, instructorIds),
    ]);

  const accessibleGroupIds = await loadAccessibleGroupIds(input.workspaceId);
  const isOwner = membership.role === "owner_admin";

  const courses: CourseListItem[] = rows.map((row) => {
    const groups = groupsByCourse.get(row.id as UUID) ?? [];
    const allInAccess = groups.every((group) => accessibleGroupIds.has(group.id));
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      cardColor: row.card_color,
      bannerUrl: row.banner_url,
      groups,
      instructor: row.instructor_member_id
        ? (instructorMap.get(row.instructor_member_id as UUID) ?? null)
        : null,
      participantCount: participantCounts.get(row.id as UUID) ?? 0,
      sessionCount: sessionCounts.get(row.id as UUID) ?? 0,
      canManageFullCourse: isOwner || allInAccess,
      canManageScopedParticipants:
        isOwner || groups.some((group) => accessibleGroupIds.has(group.id)),
    };
  });

  const totalCount = count ?? rows.length;
  return apiOk({
    courses,
    pageInfo: {
      page,
      pageSize,
      totalCount,
      hasNextPage: from + rows.length < totalCount,
    },
  });
}

export type CourseFormOptions = {
  groups: GroupSummary[];
  instructors: InstructorSummary[];
  participantCandidates: Array<
    ParticipantSummary & {
      groups: GroupSummary[];
      defaultAssignmentGroupIds: UUID[];
    }
  >;
};

export async function getCourseFormOptions(input: {
  workspaceId: UUID;
  groupIds?: UUID[];
}): Promise<ApiResult<CourseFormOptions>> {
  await requireUser();
  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  const supabase = await createSupabaseServerClient();

  const { data: groupRows } = await supabase
    .from("groups")
    .select("id, name, description, status")
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .order("name");
  const groups: GroupSummary[] = (groupRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
  }));

  const { data: instructorRows } = await supabase
    .from("workspace_members")
    .select("id, email, display_name, role, status")
    .eq("workspace_id", input.workspaceId)
    .eq("role", "instructor")
    .in("status", ["active", "invited"])
    .order("display_name", { ascending: true, nullsFirst: false });
  const instructors: InstructorSummary[] = (instructorRows ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
  }));

  const groupIds = input.groupIds ?? [];
  let participantCandidates: CourseFormOptions["participantCandidates"] = [];
  if (groupIds.length > 0) {
    const { data: pgRows } = await supabase
      .from("participant_groups")
      .select(
        "participant_id, group_id, participant:participants!inner ( id, name, memo, status, deleted_at )",
      )
      .eq("workspace_id", input.workspaceId)
      .eq("status", "active")
      .in("group_id", groupIds);

    const byParticipant = new Map<
      UUID,
      { participant: ParticipantSummary; groupIds: Set<UUID> }
    >();
    for (const row of pgRows ?? []) {
      const p = row.participant as unknown as
        | {
            id: UUID;
            name: string;
            memo: string | null;
            status: ParticipantSummary["status"];
            deleted_at: string | null;
          }
        | null;
      if (!p || p.deleted_at || p.status !== "active") continue;
      const entry = byParticipant.get(p.id) ?? {
        participant: {
          id: p.id,
          name: p.name,
          memo: p.memo,
          status: p.status,
        },
        groupIds: new Set<UUID>(),
      };
      entry.groupIds.add(row.group_id as UUID);
      byParticipant.set(p.id, entry);
    }

    const groupMap = new Map(groups.map((group) => [group.id, group]));
    participantCandidates = Array.from(byParticipant.values()).map((entry) => {
      const matchedGroups = Array.from(entry.groupIds)
        .filter((id) => groupIds.includes(id))
        .map((id) => groupMap.get(id))
        .filter((g): g is GroupSummary => g != null);
      return {
        ...entry.participant,
        groups: matchedGroups,
        defaultAssignmentGroupIds: matchedGroups.map((group) => group.id),
      };
    });
    participantCandidates.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  return apiOk({ groups, instructors, participantCandidates });
}

export async function createCourseAction(
  workspaceId: UUID,
  rawInput: CreateCourseInput,
): Promise<ApiResult<{ courseId: UUID }>> {
  const parsed = CreateCourseSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", firstZodMessage(parsed.error), {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }
  const input = parsed.data;

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 수업을 만들 수 없습니다.");
  }

  const supabase = await createSupabaseServerClient();
  const accessibleGroupIds = await loadAccessibleGroupIds(workspaceId);
  if (membership.role !== "owner_admin") {
    if (!input.groupIds.every((id) => accessibleGroupIds.has(id))) {
      return apiError(
        "SCOPE_FORBIDDEN",
        "접근 권한이 있는 그룹만 연결할 수 있습니다.",
      );
    }
  }

  // 각 참여자 배정의 assignmentGroupIds가 수업의 연결 그룹 안에 있는지 사전 확인.
  const groupIdSet = new Set(input.groupIds);
  for (const assignment of input.participantAssignments) {
    if (
      !assignment.assignmentGroupIds.every((gid) => groupIdSet.has(gid))
    ) {
      return apiError(
        "VALIDATION_FAILED",
        "참여자의 수업 내 참여 그룹은 연결 그룹 중에서만 선택할 수 있습니다.",
      );
    }
  }

  // 그룹/참여자 스냅샷 데이터 사전 로드.
  const [groupSnapshots, participantSnapshots] = await Promise.all([
    loadGroupSnapshots(workspaceId, input.groupIds),
    loadParticipantSnapshots(
      workspaceId,
      input.participantAssignments.map((row) => row.participantId),
    ),
  ]);
  if (groupSnapshots.size !== input.groupIds.length) {
    return apiError("NOT_FOUND", "선택한 그룹 중 일부를 찾을 수 없습니다.");
  }
  if (
    participantSnapshots.size !==
    new Set(input.participantAssignments.map((row) => row.participantId)).size
  ) {
    return apiError("NOT_FOUND", "선택한 참여자 중 일부를 찾을 수 없습니다.");
  }

  // 회차 계산.
  const sessions = planSessions(input.recurrence);
  if (sessions.length === 0) {
    return apiError(
      "VALIDATION_FAILED",
      "선택한 조건으로 생성될 회차가 없습니다. 요일과 기간을 다시 확인해 주세요.",
    );
  }

  // 단계별 insert (best-effort transaction via cleanup on failure).
  const now = new Date().toISOString();
  const { data: courseRow, error: courseError } = await supabase
    .from("courses")
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      status: input.status,
      instructor_member_id: input.instructorMemberId ?? null,
      card_color: input.cardColor ?? null,
      banner_url: input.bannerUrl ?? null,
      starts_on: input.recurrence.startsOn,
      ends_on: input.recurrence.endsOn ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (courseError || !courseRow) {
    return apiError(
      "INTERNAL_ERROR",
      courseError?.message ?? "수업을 만들지 못했습니다.",
    );
  }
  const courseId = courseRow.id as UUID;

  const rollback = async (message: string): Promise<ApiResult<never>> => {
    await supabase.from("courses").delete().eq("id", courseId);
    return apiError("INTERNAL_ERROR", message);
  };

  const { error: recurrenceError } = await supabase
    .from("course_recurrence_rules")
    .insert({
      workspace_id: workspaceId,
      course_id: courseId,
      repeat_weekdays: input.recurrence.repeatWeekdays,
      starts_at: input.recurrence.startsAt,
      ends_at: input.recurrence.endsAt,
      ends_on: input.recurrence.endsOn ?? null,
      session_count: input.recurrence.sessionCount ?? null,
    });
  if (recurrenceError) return rollback(recurrenceError.message);

  const groupRows = input.groupIds.map((groupId) => ({
    workspace_id: workspaceId,
    course_id: courseId,
    group_id: groupId,
    group_name_snapshot: groupSnapshots.get(groupId) ?? "",
  }));
  const { error: groupError } = await supabase
    .from("course_groups")
    .insert(groupRows);
  if (groupError) return rollback(groupError.message);

  const sessionRows = sessions.map((plan) => ({
    workspace_id: workspaceId,
    course_id: courseId,
    session_no: plan.sessionNo,
    date: plan.date,
    starts_at: plan.startsAt,
    ends_at: plan.endsAt,
  }));
  const { error: sessionError } = await supabase
    .from("course_sessions")
    .insert(sessionRows);
  if (sessionError) return rollback(sessionError.message);

  if (input.participantAssignments.length > 0) {
    const participantRows = input.participantAssignments.map((assignment) => ({
      workspace_id: workspaceId,
      course_id: courseId,
      participant_id: assignment.participantId,
      status: "active" as const,
      participant_name_snapshot:
        participantSnapshots.get(assignment.participantId) ?? "",
    }));
    const { data: insertedParticipants, error: participantError } = await supabase
      .from("course_participants")
      .insert(participantRows)
      .select("id, participant_id");
    if (participantError || !insertedParticipants) {
      return rollback(participantError?.message ?? "참여자 배정에 실패했습니다.");
    }

    const participantIdToCourseParticipantId = new Map<UUID, UUID>();
    for (const row of insertedParticipants) {
      participantIdToCourseParticipantId.set(
        row.participant_id as UUID,
        row.id as UUID,
      );
    }

    const groupAssignmentRows = input.participantAssignments.flatMap(
      (assignment) =>
        assignment.assignmentGroupIds.map((groupId) => ({
          workspace_id: workspaceId,
          course_participant_id: participantIdToCourseParticipantId.get(
            assignment.participantId,
          )!,
          group_id: groupId,
          group_name_snapshot: groupSnapshots.get(groupId) ?? "",
        })),
    );

    if (groupAssignmentRows.length > 0) {
      const { error: groupAssignmentError } = await supabase
        .from("course_participant_groups")
        .insert(groupAssignmentRows);
      if (groupAssignmentError) return rollback(groupAssignmentError.message);
    }
  }

  revalidatePath(`/workspaces/${workspaceId}/manage/courses`);
  revalidatePath(`/workspaces/${workspaceId}/home`);
  return apiOk({ courseId });
}

export async function updateCourseAction(
  workspaceId: UUID,
  courseId: UUID,
  rawInput: UpdateCourseInput,
): Promise<ApiResult<{ courseId: UUID }>> {
  const parsed = UpdateCourseSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", firstZodMessage(parsed.error), {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 수업을 수정할 수 없습니다.");
  }

  const supabase = await createSupabaseServerClient();

  // 수업 존재 + 현재 연결 그룹 조회 (권한 재검증용)
  const { data: courseRow, error: courseFetchError } = await supabase
    .from("courses")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();
  if (courseFetchError) {
    return apiError("INTERNAL_ERROR", courseFetchError.message);
  }
  if (!courseRow) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const { data: currentGroupRows, error: currentGroupsError } = await supabase
    .from("course_groups")
    .select("group_id")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId);
  if (currentGroupsError) {
    return apiError("INTERNAL_ERROR", currentGroupsError.message);
  }
  const currentGroupIds = new Set<UUID>(
    (currentGroupRows ?? []).map((row) => row.group_id as UUID),
  );

  // group_admin이면 현재 수업의 모든 연결 그룹이 본인 접근 범위 안이어야 수정 가능
  const accessibleGroupIds = await loadAccessibleGroupIds(workspaceId);
  const isOwner = membership.role === "owner_admin";
  if (!isOwner) {
    const allInAccess = [...currentGroupIds].every((id) =>
      accessibleGroupIds.has(id),
    );
    if (!allInAccess) {
      return apiError(
        "SCOPE_FORBIDDEN",
        "이 수업의 일부 그룹에 접근 권한이 없어 수정할 수 없습니다.",
      );
    }
  }

  // 1) groupIds 변경 처리 (선택값일 때만)
  if (parsed.data.groupIds !== undefined) {
    const nextGroupIds = new Set<UUID>(parsed.data.groupIds);
    const toRemove = [...currentGroupIds].filter((id) => !nextGroupIds.has(id));
    const toAdd = [...nextGroupIds].filter((id) => !currentGroupIds.has(id));

    if (toAdd.length > 0) {
      // 추가 그룹이 워크스페이스 활성 그룹인지 확인 + group_admin이면 접근 범위
      const { data: addRows, error: addLookupError } = await supabase
        .from("groups")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .in("id", toAdd);
      if (addLookupError) {
        return apiError("INTERNAL_ERROR", addLookupError.message);
      }
      const foundIds = new Set((addRows ?? []).map((row) => row.id as UUID));
      if (foundIds.size !== toAdd.length) {
        return apiError(
          "VALIDATION_FAILED",
          "선택한 그룹 중 일부를 찾을 수 없습니다.",
        );
      }
      if (!isOwner && !toAdd.every((id) => accessibleGroupIds.has(id))) {
        return apiError(
          "SCOPE_FORBIDDEN",
          "접근 권한이 있는 그룹만 연결할 수 있습니다.",
        );
      }

      const insertRows = (addRows ?? []).map((row) => ({
        workspace_id: workspaceId,
        course_id: courseId,
        group_id: row.id,
        group_name_snapshot: row.name,
      }));
      const { error: groupInsertError } = await supabase
        .from("course_groups")
        .insert(insertRows);
      if (groupInsertError) {
        return apiError("INTERNAL_ERROR", groupInsertError.message);
      }
    }

    if (toRemove.length > 0) {
      // 연결 해제만 한다. course_participant_groups 행은 보존해
      // 같은 그룹을 다시 연결했을 때 참여자 배정이 자동 복원되도록 한다.
      // (course_participant_groups.group_id FK는 groups를 직접 참조하므로
      // course_groups 삭제로 cascade되지 않으며, insert/update 트리거도
      // 기존 행을 건드리지 않는다. 표시 계층에서 현재 연결된 그룹으로 필터링한다.)
      const { error: cgDeleteError } = await supabase
        .from("course_groups")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("course_id", courseId)
        .in("group_id", toRemove);
      if (cgDeleteError) {
        return apiError("INTERNAL_ERROR", cgDeleteError.message);
      }
    }
  }

  // 2) 스칼라 필드 갱신
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.instructorMemberId !== undefined)
    updates.instructor_member_id = parsed.data.instructorMemberId;
  if (parsed.data.cardColor !== undefined) updates.card_color = parsed.data.cardColor;
  if (parsed.data.bannerUrl !== undefined) updates.banner_url = parsed.data.bannerUrl;

  // updated_at만 있는 빈 업데이트도 그냥 통과시킴 — 변경 없는 경우라도 무해.
  const { error } = await supabase
    .from("courses")
    .update(updates)
    .eq("workspace_id", workspaceId)
    .eq("id", courseId);
  if (error) return apiError("INTERNAL_ERROR", error.message);

  revalidatePath(`/workspaces/${workspaceId}/manage/courses`);
  revalidatePath(`/workspaces/${workspaceId}/home`);
  revalidatePath(`/workspaces/${workspaceId}/courses/${courseId}/home`);
  revalidatePath(`/workspaces/${workspaceId}/courses/${courseId}/participants`);
  return apiOk({ courseId });
}

// ─────────────────────────────────────────────────────────────
// 수업 편집 화면 데이터
// ─────────────────────────────────────────────────────────────

export type CourseEditData = {
  course: {
    id: UUID;
    name: string;
    status: CourseStatus;
    instructorMemberId: UUID | null;
    groupIds: UUID[];
    cardColor: string | null;
    bannerUrl: string | null;
  };
  options: {
    groups: GroupSummary[];
    instructors: InstructorSummary[];
  };
  canManageFullCourse: boolean;
};

export async function getCourseEditData(input: {
  workspaceId: UUID;
  courseId: UUID;
}): Promise<ApiResult<CourseEditData>> {
  await requireUser();
  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 수업 정보를 수정할 수 없습니다.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: courseRow, error: courseError } = await supabase
    .from("courses")
    .select(
      "id, name, status, instructor_member_id, card_color, banner_url",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.courseId)
    .maybeSingle();
  if (courseError) return apiError("INTERNAL_ERROR", courseError.message);
  if (!courseRow) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const { data: groupLinks, error: groupsError } = await supabase
    .from("course_groups")
    .select("group_id")
    .eq("workspace_id", input.workspaceId)
    .eq("course_id", input.courseId);
  if (groupsError) return apiError("INTERNAL_ERROR", groupsError.message);
  const currentGroupIds = (groupLinks ?? []).map((row) => row.group_id as UUID);

  const accessibleGroupIds = await loadAccessibleGroupIds(input.workspaceId);
  const isOwner = membership.role === "owner_admin";
  const canManageFullCourse =
    isOwner || currentGroupIds.every((id) => accessibleGroupIds.has(id));

  const { data: groupRows } = await supabase
    .from("groups")
    .select("id, name, description, status")
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .order("name");
  const allGroups: GroupSummary[] = (groupRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
  }));
  // group_admin이면 본인 접근 그룹 + 현재 수업 연결 그룹(범위 밖이라도 표시) 합집합으로 노출.
  // 단, canManageFullCourse=false면 어차피 폼이 안 보이지만 안전상 owner는 전체.
  const visibleGroups = isOwner
    ? allGroups
    : allGroups.filter(
        (group) =>
          accessibleGroupIds.has(group.id) ||
          currentGroupIds.includes(group.id),
      );

  const { data: instructorRows } = await supabase
    .from("workspace_members")
    .select("id, email, display_name, role, status")
    .eq("workspace_id", input.workspaceId)
    .eq("role", "instructor")
    .in("status", ["active", "invited"])
    .order("display_name", { ascending: true, nullsFirst: false });
  const instructors: InstructorSummary[] = (instructorRows ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
  }));

  return apiOk({
    course: {
      id: courseRow.id,
      name: courseRow.name,
      status: courseRow.status,
      instructorMemberId: courseRow.instructor_member_id,
      groupIds: currentGroupIds,
      cardColor: courseRow.card_color,
      bannerUrl: courseRow.banner_url,
    },
    options: {
      groups: visibleGroups,
      instructors,
    },
    canManageFullCourse,
  });
}

export async function updateCourseParticipantAssignmentAction(
  workspaceId: UUID,
  courseId: UUID,
  participantId: UUID,
  rawInput: UpdateCourseParticipantAssignmentInput,
): Promise<ApiResult<{ courseParticipantId: UUID; assignmentGroupIds: UUID[] }>> {
  const parsed = UpdateCourseParticipantAssignmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", firstZodMessage(parsed.error));
  }

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 참여자 배정을 변경할 수 없습니다.");
  }
  const supabase = await createSupabaseServerClient();
  const accessibleGroupIds = await loadAccessibleGroupIds(workspaceId);
  const isOwner = membership.role === "owner_admin";

  const { data: courseGroupsRows, error: courseGroupsError } = await supabase
    .from("course_groups")
    .select("group_id, group_name_snapshot")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId);
  if (courseGroupsError) {
    return apiError("INTERNAL_ERROR", courseGroupsError.message);
  }
  const courseGroupNameById = new Map<UUID, string>();
  for (const row of courseGroupsRows ?? []) {
    courseGroupNameById.set(
      row.group_id as UUID,
      row.group_name_snapshot ?? "",
    );
  }
  if (
    !parsed.data.assignmentGroupIds.every((id) => courseGroupNameById.has(id))
  ) {
    return apiError(
      "VALIDATION_FAILED",
      "수업 내 참여 그룹은 연결 그룹 중에서만 선택할 수 있습니다.",
    );
  }
  if (
    !isOwner &&
    !parsed.data.assignmentGroupIds.every((id) => accessibleGroupIds.has(id))
  ) {
    return apiError(
      "SCOPE_FORBIDDEN",
      "접근 권한이 있는 그룹만 추가할 수 있습니다.",
    );
  }

  const { data: cpRow, error: cpFetchError } = await supabase
    .from("course_participants")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (cpFetchError) return apiError("INTERNAL_ERROR", cpFetchError.message);
  if (!cpRow) return apiError("NOT_FOUND", "수업 참여자 배정을 찾을 수 없습니다.");
  const courseParticipantId = cpRow.id as UUID;

  const { data: currentGroupRows, error: currentGroupsError } = await supabase
    .from("course_participant_groups")
    .select("group_id")
    .eq("course_participant_id", courseParticipantId);
  if (currentGroupsError) {
    return apiError("INTERNAL_ERROR", currentGroupsError.message);
  }
  const currentGroupIds = new Set<UUID>(
    (currentGroupRows ?? []).map((row) => row.group_id as UUID),
  );
  const targetGroupIds = new Set<UUID>(parsed.data.assignmentGroupIds);

  let nextGroupIds: Set<UUID>;
  if (isOwner) {
    nextGroupIds = targetGroupIds;
  } else {
    nextGroupIds = new Set<UUID>(currentGroupIds);
    for (const id of accessibleGroupIds) {
      if (targetGroupIds.has(id)) nextGroupIds.add(id);
      else nextGroupIds.delete(id);
    }
  }

  const toAdd = [...nextGroupIds].filter((id) => !currentGroupIds.has(id));
  const toRemove = [...currentGroupIds].filter((id) => !nextGroupIds.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("course_participant_groups")
      .delete()
      .eq("course_participant_id", courseParticipantId)
      .in("group_id", toRemove);
    if (error) return apiError("INTERNAL_ERROR", error.message);
  }
  if (toAdd.length > 0) {
    const rows = toAdd.map((groupId) => ({
      workspace_id: workspaceId,
      course_participant_id: courseParticipantId,
      group_id: groupId,
      group_name_snapshot: courseGroupNameById.get(groupId) ?? "",
    }));
    const { error } = await supabase
      .from("course_participant_groups")
      .insert(rows);
    if (error) return apiError("INTERNAL_ERROR", error.message);
  }

  // status: 명시값이 있으면 그대로. 없고 nextGroupIds가 비면 excluded로.
  const finalStatus =
    parsed.data.status ?? (nextGroupIds.size === 0 ? "excluded" : "active");
  const { error: statusError } = await supabase
    .from("course_participants")
    .update({ status: finalStatus, updated_at: new Date().toISOString() })
    .eq("id", courseParticipantId);
  if (statusError) return apiError("INTERNAL_ERROR", statusError.message);

  revalidatePath(`/workspaces/${workspaceId}/manage/courses`);
  revalidatePath(`/workspaces/${workspaceId}/home`);
  revalidatePath(`/workspaces/${workspaceId}/courses/${courseId}/home`);
  revalidatePath(`/workspaces/${workspaceId}/courses/${courseId}/participants`);
  return apiOk({
    courseParticipantId,
    assignmentGroupIds: [...nextGroupIds],
  });
}

// --- internal helpers ---

type CurrentMembership = {
  memberId: UUID;
  role: "owner_admin" | "group_admin" | "instructor";
};

async function loadCurrentMembership(
  workspaceId: UUID,
): Promise<CurrentMembership | null> {
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

async function loadAccessibleGroupIds(workspaceId: UUID): Promise<Set<UUID>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("accessible_group_ids", {
    target_workspace_id: workspaceId,
  });
  const ids: UUID[] = Array.isArray(data)
    ? (data as Array<string | { accessible_group_ids: string }>).map((row) =>
        typeof row === "string" ? row : (row.accessible_group_ids ?? ""),
      )
    : [];
  return new Set(ids.filter((id) => id.length > 0));
}

async function loadGroupsByCourse(
  workspaceId: UUID,
  courseIds: UUID[],
): Promise<Map<UUID, GroupSummary[]>> {
  const result = new Map<UUID, GroupSummary[]>();
  if (courseIds.length === 0) return result;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_groups")
    .select(
      "course_id, group_id, group_name_snapshot, group:groups ( id, name, description, status, deleted_at )",
    )
    .eq("workspace_id", workspaceId)
    .in("course_id", courseIds);

  for (const row of data ?? []) {
    const group = row.group as unknown as
      | {
          id: UUID;
          name: string;
          description: string | null;
          status: GroupSummary["status"];
          deleted_at: string | null;
        }
      | null;
    const summary: GroupSummary = group && !group.deleted_at
      ? {
          id: group.id,
          name: group.name,
          description: group.description,
          status: group.status,
        }
      : {
          id: row.group_id as UUID,
          name: row.group_name_snapshot ?? "(삭제된 그룹)",
          description: null,
          status: "inactive",
        };
    const list = result.get(row.course_id as UUID) ?? [];
    list.push(summary);
    result.set(row.course_id as UUID, list);
  }
  return result;
}

async function loadParticipantCounts(
  courseIds: UUID[],
): Promise<Map<UUID, number>> {
  const counts = new Map<UUID, number>();
  if (courseIds.length === 0) return counts;
  const supabase = await createSupabaseServerClient();

  // 수업의 참여자 수 = 현재 연결된 활성 그룹들의 활성 구성원(distinct, 마스터 미삭제) 수.
  // course_participants 배정 여부와 무관하게 그룹 연결로만 결정되어
  // manage/groups의 그룹 인원수와 일관된다. 카운트 의미는 architecture.md "참여자 수 표시 의미" 참고.
  const { data: cgRows } = await supabase
    .from("course_groups")
    .select("course_id, group_id, group:groups!inner(deleted_at)")
    .in("course_id", courseIds)
    .is("group.deleted_at", null);
  const coursesByGroup = new Map<UUID, UUID[]>();
  const groupIdSet = new Set<UUID>();
  for (const row of cgRows ?? []) {
    const courseId = row.course_id as UUID;
    const groupId = row.group_id as UUID;
    groupIdSet.add(groupId);
    let list = coursesByGroup.get(groupId);
    if (!list) {
      list = [];
      coursesByGroup.set(groupId, list);
    }
    list.push(courseId);
  }
  if (groupIdSet.size === 0) return counts;

  const { data: pgRows } = await supabase
    .from("participant_groups")
    .select("participant_id, group_id, participant:participants!inner(deleted_at)")
    .in("group_id", Array.from(groupIdSet))
    .eq("status", "active")
    .is("participant.deleted_at", null);

  const countedByCourse = new Map<UUID, Set<UUID>>();
  for (const row of pgRows ?? []) {
    const groupId = row.group_id as UUID;
    const participantId = row.participant_id as UUID;
    const courses = coursesByGroup.get(groupId);
    if (!courses) continue;
    for (const courseId of courses) {
      let seen = countedByCourse.get(courseId);
      if (!seen) {
        seen = new Set<UUID>();
        countedByCourse.set(courseId, seen);
      }
      seen.add(participantId);
    }
  }
  for (const [courseId, seen] of countedByCourse) {
    counts.set(courseId, seen.size);
  }
  return counts;
}

async function loadSessionCounts(courseIds: UUID[]): Promise<Map<UUID, number>> {
  const counts = new Map<UUID, number>();
  if (courseIds.length === 0) return counts;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_sessions")
    .select("course_id")
    .in("course_id", courseIds);
  for (const row of data ?? []) {
    const id = row.course_id as UUID;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

async function loadInstructors(
  workspaceId: UUID,
  memberIds: UUID[],
): Promise<Map<UUID, InstructorSummary>> {
  const result = new Map<UUID, InstructorSummary>();
  if (memberIds.length === 0) return result;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("id, email, display_name, status")
    .eq("workspace_id", workspaceId)
    .in("id", memberIds);
  for (const row of data ?? []) {
    result.set(row.id as UUID, {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      status: row.status,
    });
  }
  return result;
}

async function loadGroupSnapshots(
  workspaceId: UUID,
  groupIds: UUID[],
): Promise<Map<UUID, string>> {
  const result = new Map<UUID, string>();
  if (groupIds.length === 0) return result;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("groups")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .in("id", groupIds);
  for (const row of data ?? []) {
    result.set(row.id as UUID, row.name);
  }
  return result;
}

async function loadParticipantSnapshots(
  workspaceId: UUID,
  participantIds: UUID[],
): Promise<Map<UUID, string>> {
  const result = new Map<UUID, string>();
  if (participantIds.length === 0) return result;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("participants")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .in("id", participantIds);
  for (const row of data ?? []) {
    result.set(row.id as UUID, row.name);
  }
  return result;
}

function firstZodMessage(error: import("zod").ZodError): string {
  return error.issues[0]?.message ?? "입력값을 확인해 주세요.";
}

function collectFieldErrors(
  error: import("zod").ZodError,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    (result[path] ??= []).push(issue.message);
  }
  return result;
}
