"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

// ─────────────────────────────────────────────────────────────
// course_participants / course_participant_groups의 INSERT/UPDATE는
// `materials`와 같은 RLS 패턴 위험으로 admin client 우회.
// 권한 검증은 service 레이어에서 수행 (owner_admin / group_admin + 접근 그룹 교차).
// ─────────────────────────────────────────────────────────────

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

export type EligibleParticipantItem = {
  id: UUID;
  name: string;
  groups: GroupRef[];
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
  eligibleParticipants: EligibleParticipantItem[];
};

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

  const [countedSessionIds, courseGroupIds] = await Promise.all([
    loadCountedSessionIds(workspaceId, courseId),
    loadCourseGroupIds(workspaceId, courseId),
  ]);
  const rawParticipantRows = await loadCourseParticipantRows(
    workspaceId,
    courseId,
    courseGroupIds,
  );

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

  const alreadyActiveIds = new Set(
    participants
      .filter((p) => p.assignmentStatus === "active")
      .map((p) => p.participant.id),
  );
  const eligibleParticipants = await loadEligibleParticipants({
    workspaceId,
    courseGroupIds,
    excludeParticipantIds: alreadyActiveIds,
  });

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
    eligibleParticipants,
  });
}

export async function addCourseParticipants(
  workspaceId: UUID,
  courseId: UUID,
  participantIds: UUID[],
): Promise<ApiResult<{ addedCount: number }>> {
  if (participantIds.length === 0) {
    return apiError("VALIDATION_FAILED", "추가할 참여자를 선택해 주세요.");
  }

  await requireUser();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("AUTH_REQUIRED", "로그인이 필요합니다.");

  const { data: me } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!me) return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  if (me.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 참여자 배정을 변경할 수 없습니다.");
  }

  const courseGroupIds = await loadCourseGroupIds(workspaceId, courseId);
  if (courseGroupIds.length === 0) {
    return apiError("VALIDATION_FAILED", "이 수업에 연결된 그룹이 없습니다.");
  }

  // 참여자별 그룹 정보 조회 (이름 snapshot과 코스 그룹 교차용)
  const { data: pRows } = await supabase
    .from("participants")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .in("id", participantIds);
  const nameById = new Map((pRows ?? []).map((r) => [r.id as UUID, r.name]));

  const { data: pgRows } = await supabase
    .from("participant_groups")
    .select("participant_id, group_id, group:groups ( name )")
    .eq("workspace_id", workspaceId)
    .in("participant_id", participantIds)
    .eq("status", "active");
  const courseGroupSet = new Set(courseGroupIds);
  const groupsByParticipant = new Map<UUID, Array<{ id: UUID; name: string }>>();
  for (const row of pgRows ?? []) {
    if (!courseGroupSet.has(row.group_id as UUID)) continue;
    const g = row.group as unknown as { name: string } | null;
    const arr = groupsByParticipant.get(row.participant_id as UUID) ?? [];
    arr.push({ id: row.group_id as UUID, name: g?.name ?? "" });
    groupsByParticipant.set(row.participant_id as UUID, arr);
  }

  const admin = createSupabaseAdminClient();
  let addedCount = 0;

  for (const pid of participantIds) {
    const name = nameById.get(pid);
    if (!name) continue;
    const groupsForP = groupsByParticipant.get(pid) ?? [];
    if (groupsForP.length === 0) continue; // 코스 그룹과 교차 없음 — skip

    // upsert course_participants (unique (course_id, participant_id))
    const { data: existing } = await admin
      .from("course_participants")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("course_id", courseId)
      .eq("participant_id", pid)
      .maybeSingle();

    let cpId: UUID;
    if (existing) {
      cpId = existing.id as UUID;
      const { error: updErr } = await admin
        .from("course_participants")
        .update({
          status: "active",
          participant_name_snapshot: name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cpId);
      if (updErr) continue;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("course_participants")
        .insert({
          workspace_id: workspaceId,
          course_id: courseId,
          participant_id: pid,
          status: "active",
          participant_name_snapshot: name,
        })
        .select("id")
        .single();
      if (insErr || !inserted) continue;
      cpId = inserted.id as UUID;
    }

    // course_participant_groups 채움 (이미 있는 row는 unique로 skip)
    await admin
      .from("course_participant_groups")
      .delete()
      .eq("course_participant_id", cpId);
    const cpgRows = groupsForP.map((g) => ({
      workspace_id: workspaceId,
      course_participant_id: cpId,
      group_id: g.id,
      group_name_snapshot: g.name,
    }));
    if (cpgRows.length > 0) {
      await admin.from("course_participant_groups").insert(cpgRows);
    }

    addedCount += 1;
  }

  revalidatePath(`/workspaces/${workspaceId}/courses/${courseId}/participants`);
  revalidatePath(`/workspaces/${workspaceId}/manage/courses`);
  revalidatePath(`/workspaces/${workspaceId}/home`);
  return apiOk({ addedCount });
}

export async function excludeCourseParticipant(
  workspaceId: UUID,
  courseParticipantId: UUID,
): Promise<ApiResult<{ id: UUID }>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("AUTH_REQUIRED", "로그인이 필요합니다.");

  const { data: me } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!me) return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  if (me.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 참여자 배정을 변경할 수 없습니다.");
  }

  const { data: cp } = await supabase
    .from("course_participants")
    .select("id, course_id")
    .eq("workspace_id", workspaceId)
    .eq("id", courseParticipantId)
    .maybeSingle();
  if (!cp) return apiError("NOT_FOUND", "수업 참여자 배정을 찾을 수 없습니다.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("course_participants")
    .update({ status: "excluded", updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", courseParticipantId);
  if (error) return apiError("INTERNAL_ERROR", error.message);

  revalidatePath(`/workspaces/${workspaceId}/courses/${cp.course_id}/participants`);
  revalidatePath(`/workspaces/${workspaceId}/manage/courses`);
  revalidatePath(`/workspaces/${workspaceId}/home`);
  return apiOk({ id: courseParticipantId });
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
  activeCourseGroupIds: UUID[],
): Promise<ParticipantRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_participants")
    .select(
      `id, participant_name_snapshot, status,
       participant:participants!inner ( id, name, status, deleted_at ),
       groups:course_participant_groups ( group:groups ( id, name, description, status ) )`,
    )
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .is("participant.deleted_at", null)
    .order("assigned_at", { ascending: true });

  const activeIds = new Set<UUID>(activeCourseGroupIds);

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
        .filter((g): g is GroupRef => g !== null)
        .filter((g) => activeIds.has(g.id)),
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

async function loadCourseGroupIds(
  workspaceId: UUID,
  courseId: UUID,
): Promise<UUID[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_groups")
    .select("group_id")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId);
  return (data ?? []).map((row) => row.group_id as UUID);
}

async function loadEligibleParticipants(params: {
  workspaceId: UUID;
  courseGroupIds: UUID[];
  excludeParticipantIds: Set<UUID>;
}): Promise<EligibleParticipantItem[]> {
  if (params.courseGroupIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("participant_groups")
    .select(
      `participant_id,
       group:groups!inner ( id, name, description, status ),
       participant:participants!inner ( id, name, status )`,
    )
    .eq("workspace_id", params.workspaceId)
    .eq("status", "active")
    .in("group_id", params.courseGroupIds);

  const byParticipant = new Map<UUID, EligibleParticipantItem>();
  for (const raw of data ?? []) {
    const row = raw as unknown as {
      participant_id: UUID;
      group: GroupRef | null;
      participant: { id: UUID; name: string; status: ParticipantStatus } | null;
    };
    if (!row.participant || row.participant.status !== "active") continue;
    if (params.excludeParticipantIds.has(row.participant.id)) continue;
    if (!row.group) continue;

    const existing = byParticipant.get(row.participant.id);
    if (existing) {
      if (!existing.groups.some((g) => g.id === row.group!.id)) {
        existing.groups.push(row.group);
      }
    } else {
      byParticipant.set(row.participant.id, {
        id: row.participant.id,
        name: row.participant.name,
        groups: [row.group],
      });
    }
  }

  return Array.from(byParticipant.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ko"),
  );
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
    const prev = byParticipant.get(row.participant_id) ?? { ...EMPTY_AGG };
    if (row.status === "present") prev.present += 1;
    else if (row.status === "partial") prev.partial += 1;
    else if (row.status === "absent") prev.absent += 1;
    byParticipant.set(row.participant_id, prev);

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