"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  CoursePublicVisibility,
  CourseStatus,
  ISODate,
  ISOTime,
  SessionProgressStatus,
  SessionType,
  UUID,
} from "@/lib/api/types";
import { loadCurrentMembership, type CurrentMembership } from "@/services/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PublicCourseSummary = {
  workspace: {
    id: UUID;
    name: string;
  };
  id: UUID;
  name: string;
  status: CourseStatus;
  publicVisibility: CoursePublicVisibility;
  startsOn: ISODate | null;
  endsOn: ISODate | null;
  cardColor: string | null;
  bannerUrl: string | null;
  groupNames: string[];
  sessionCount: number;
  materialCount: number;
};

export type PublicCourseCatalog = {
  workspaces: Array<{
    id: UUID;
    name: string;
    courses: PublicCourseSummary[];
  }>;
};

export type PublicCourseSession = {
  sessionNo: number;
  date: ISODate;
  startsAt: ISOTime;
  endsAt: ISOTime;
  type: SessionType;
  progressStatus: SessionProgressStatus;
};

export type PublicCourseMaterial = {
  id: UUID;
  title: string;
  description: string | null;
  originalFilename: string | null;
};

export type PublicCourseDetail = PublicCourseSummary & {
  sessions: PublicCourseSession[];
  materials: PublicCourseMaterial[];
};

type CourseRow = {
  id: UUID;
  workspace_id: UUID;
  name: string;
  status: CourseStatus;
  public_visibility: CoursePublicVisibility;
  starts_on: ISODate | null;
  ends_on: ISODate | null;
  card_color: string | null;
  banner_url: string | null;
  updated_at: string;
  created_at: string;
  instructor_member_id?: UUID | null;
  workspace?: { id: UUID; name: string } | { id: UUID; name: string }[] | null;
};

const STATUS_SORT_ORDER: Record<CourseStatus, number> = {
  in_progress: 0,
  planned: 1,
  completed: 2,
};

const DEMO_PUBLIC_COURSES: PublicCourseDetail[] = [
    {
      id: "demo-hanyang-coding" as UUID,
      workspace: { id: "demo-hanyang" as UUID, name: "한양대역 마을" },
      name: "창의 코딩으로 만드는 우리 동네 앱",
      status: "in_progress",
      publicVisibility: "public",
      startsOn: "2026-05-04",
      endsOn: "2026-06-22",
      cardColor: "#2563EB",
      bannerUrl: null,
      groupNames: ["초등 4-6학년"],
      sessionCount: 8,
      materialCount: 2,
      sessions: makeDemoSessions("2026-05-04", "16:00", "17:30", 8),
      materials: [
        {
          id: "demo-material-hanyang-coding-1" as UUID,
          title: "1회차 활동 안내",
          description: "수업 목표, 준비물, 결과물 예시를 한눈에 보는 안내 자료입니다.",
          originalFilename: "demo-activity-guide.txt",
        },
        {
          id: "demo-material-hanyang-coding-2" as UUID,
          title: "앱 아이디어 기록지",
          description: "아이들이 우리 동네 문제를 발견하고 앱 아이디어로 정리하는 활동지입니다.",
          originalFilename: "demo-app-idea-sheet.txt",
        },
      ],
    },
    {
      id: "demo-hanyang-writing" as UUID,
      workspace: { id: "demo-hanyang" as UUID, name: "한양대역 마을" },
      name: "그림책으로 여는 생각 글쓰기",
      status: "planned",
      publicVisibility: "public",
      startsOn: "2026-06-03",
      endsOn: "2026-07-08",
      cardColor: "#0F766E",
      bannerUrl: null,
      groupNames: ["초등 1-3학년"],
      sessionCount: 6,
      materialCount: 1,
      sessions: makeDemoSessions("2026-06-03", "15:30", "16:40", 6),
      materials: [
        {
          id: "demo-material-hanyang-writing-1" as UUID,
          title: "첫 모임 읽기 목록",
          description: "함께 읽을 그림책과 가정 연계 질문을 정리했습니다.",
          originalFilename: "demo-reading-list.txt",
        },
      ],
    },
    {
      id: "demo-kakao-ai" as UUID,
      workspace: { id: "demo-kakao" as UUID, name: "카카오역 마을" },
      name: "AI와 함께하는 방과후 탐구실",
      status: "in_progress",
      publicVisibility: "public",
      startsOn: "2026-05-07",
      endsOn: "2026-06-25",
      cardColor: "#7C3AED",
      bannerUrl: null,
      groupNames: ["방과후 탐구반"],
      sessionCount: 8,
      materialCount: 2,
      sessions: makeDemoSessions("2026-05-07", "16:20", "17:50", 8),
      materials: [
        {
          id: "demo-material-kakao-ai-1" as UUID,
          title: "AI 탐구 안전 약속",
          description: "AI 도구 사용 시 지켜야 할 질문 방식과 개인정보 보호 원칙입니다.",
          originalFilename: "demo-ai-safety.txt",
        },
        {
          id: "demo-material-kakao-ai-2" as UUID,
          title: "프로젝트 주제 예시",
          description: "날씨, 교통, 환경처럼 아이들이 고를 수 있는 탐구 주제 샘플입니다.",
          originalFilename: "demo-project-topics.txt",
        },
      ],
    },
    {
      id: "demo-kakao-math" as UUID,
      workspace: { id: "demo-kakao" as UUID, name: "카카오역 마을" },
      name: "보드게임 수학 전략반",
      status: "planned",
      publicVisibility: "public",
      startsOn: "2026-06-01",
      endsOn: "2026-07-06",
      cardColor: "#EA580C",
      bannerUrl: null,
      groupNames: ["방과후 탐구반"],
      sessionCount: 6,
      materialCount: 1,
      sessions: makeDemoSessions("2026-06-01", "15:00", "16:20", 6),
      materials: [
        {
          id: "demo-material-kakao-math-1" as UUID,
          title: "게임별 수학 개념표",
          description: "확률, 패턴, 추론 등 회차별로 다루는 수학 개념을 정리했습니다.",
          originalFilename: "demo-math-concepts.txt",
        },
      ],
    },
];

const DEMO_PUBLIC_COURSE_DETAILS = new Map<UUID, PublicCourseDetail>(
  DEMO_PUBLIC_COURSES.map((course) => [course.id, course]),
);

const DEMO_PUBLIC_CATALOG: PublicCourseCatalog = {
  workspaces: [
    {
      id: "demo-hanyang" as UUID,
      name: "한양대역 마을",
      courses: [
        DEMO_PUBLIC_COURSE_DETAILS.get("demo-hanyang-coding" as UUID)!,
        DEMO_PUBLIC_COURSE_DETAILS.get("demo-hanyang-writing" as UUID)!,
      ],
    },
    {
      id: "demo-kakao" as UUID,
      name: "카카오역 마을",
      courses: [
        DEMO_PUBLIC_COURSE_DETAILS.get("demo-kakao-ai" as UUID)!,
        DEMO_PUBLIC_COURSE_DETAILS.get("demo-kakao-math" as UUID)!,
      ],
    },
  ],
};

export async function getPublicCourseCatalog(): Promise<
  ApiResult<PublicCourseCatalog>
> {
  if (!hasSupabaseAdminEnv()) return apiOk(DEMO_PUBLIC_CATALOG);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("courses")
    .select(
      "id, workspace_id, name, status, public_visibility, starts_on, ends_on, card_color, banner_url, updated_at, created_at, workspace:workspaces(id, name)",
    )
    .eq("public_visibility", "public");

  if (error) return apiOk(DEMO_PUBLIC_CATALOG);

  const rows = ((data ?? []) as CourseRow[]).filter((row) => rowWorkspace(row));
  if (rows.length === 0) return apiOk(DEMO_PUBLIC_CATALOG);
  sortCourseRows(rows);

  const courseIds = rows.map((row) => row.id);
  const [groupsByCourse, sessionCounts, materialCounts] = await Promise.all([
    loadGroupNamesByCourse(courseIds),
    loadVisibleSessionCounts(courseIds),
    loadUploadedMaterialCounts(courseIds),
  ]);

  const workspaceMap = new Map<
    UUID,
    { id: UUID; name: string; courses: PublicCourseSummary[] }
  >();

  for (const row of rows) {
    const workspace = rowWorkspace(row);
    if (!workspace) continue;
    const section =
      workspaceMap.get(workspace.id) ??
      { id: workspace.id, name: workspace.name, courses: [] };
    section.courses.push(toPublicCourseSummary(row, {
      workspace,
      groupNames: groupsByCourse.get(row.id) ?? [],
      sessionCount: sessionCounts.get(row.id) ?? 0,
      materialCount: materialCounts.get(row.id) ?? 0,
    }));
    workspaceMap.set(workspace.id, section);
  }

  return apiOk({
    workspaces: Array.from(workspaceMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "ko"),
    ),
  });
}

export async function getPublicCourseDetail(
  courseId: UUID,
): Promise<ApiResult<PublicCourseDetail>> {
  const demoCourse = DEMO_PUBLIC_COURSE_DETAILS.get(courseId);
  if (demoCourse) return apiOk(demoCourse);

  const result = await loadPublicCourseDetail({
    courseId,
    publicOnly: true,
  });
  if (!result.ok && result.error.code === "NOT_FOUND") {
    return apiError("NOT_FOUND", "공개 수업을 찾을 수 없습니다.");
  }
  return result;
}

export async function getCoursePublicPreview(input: {
  workspaceId: UUID;
  courseId: UUID;
}): Promise<ApiResult<PublicCourseDetail>> {
  await requireUser();
  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const course = await loadCourseAccessRow(input.workspaceId, input.courseId);
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const canView = await canAccessCourseForMembership({
    workspaceId: input.workspaceId,
    membership,
    course,
  });
  if (!canView) {
    return apiError("SCOPE_FORBIDDEN", "이 수업에 접근할 수 없습니다.");
  }

  return loadPublicCourseDetail({
    workspaceId: input.workspaceId,
    courseId: input.courseId,
    publicOnly: false,
  });
}

export async function updateCoursePublicVisibility(input: {
  workspaceId: UUID;
  courseId: UUID;
  publicVisibility: CoursePublicVisibility;
}): Promise<ApiResult<{ publicVisibility: CoursePublicVisibility }>> {
  if (!["public", "hidden"].includes(input.publicVisibility)) {
    return apiError("VALIDATION_FAILED", "공개 상태 값이 올바르지 않습니다.");
  }

  await requireUser();
  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 공개 상태를 변경할 수 없습니다.");
  }

  const course = await loadCourseAccessRow(input.workspaceId, input.courseId);
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const canManage = await canManageFullCourseForMembership({
    workspaceId: input.workspaceId,
    membership,
    courseId: input.courseId,
  });
  if (!canManage) {
    return apiError(
      "SCOPE_FORBIDDEN",
      "이 수업의 모든 그룹에 대한 관리 권한이 필요합니다.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("courses")
    .update({
      public_visibility: input.publicVisibility,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.courseId);
  if (error) return apiError("INTERNAL_ERROR", error.message);

  revalidatePath("/");
  revalidatePath(`/public/courses/${input.courseId}`);
  revalidatePath(`/workspaces/${input.workspaceId}/courses/${input.courseId}/home`);

  return apiOk({ publicVisibility: input.publicVisibility });
}

async function loadPublicCourseDetail(input: {
  courseId: UUID;
  workspaceId?: UUID;
  publicOnly: boolean;
}): Promise<ApiResult<PublicCourseDetail>> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("courses")
    .select(
      "id, workspace_id, name, status, public_visibility, starts_on, ends_on, card_color, banner_url, updated_at, created_at, workspace:workspaces(id, name)",
    )
    .eq("id", input.courseId);

  if (input.workspaceId) query = query.eq("workspace_id", input.workspaceId);
  if (input.publicOnly) query = query.eq("public_visibility", "public");

  const { data: row, error } = await query.maybeSingle();
  if (error) return apiError("INTERNAL_ERROR", error.message);
  if (!row) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const course = row as CourseRow;
  const workspace = rowWorkspace(course);
  if (!workspace) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const [groupsByCourse, sessions, materials] = await Promise.all([
    loadGroupNamesByCourse([course.id]),
    loadPublicSessions(course.id),
    loadPublicMaterials(course.id),
  ]);

  return apiOk({
    ...toPublicCourseSummary(course, {
      workspace,
      groupNames: groupsByCourse.get(course.id) ?? [],
      sessionCount: sessions.length,
      materialCount: materials.length,
    }),
    sessions,
    materials,
  });
}

function toPublicCourseSummary(
  row: CourseRow,
  derived: {
    workspace: { id: UUID; name: string };
    groupNames: string[];
    sessionCount: number;
    materialCount: number;
  },
): PublicCourseSummary {
  return {
    workspace: derived.workspace,
    id: row.id,
    name: row.name,
    status: row.status,
    publicVisibility: row.public_visibility,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    cardColor: row.card_color,
    bannerUrl: row.banner_url,
    groupNames: derived.groupNames,
    sessionCount: derived.sessionCount,
    materialCount: derived.materialCount,
  };
}

function rowWorkspace(row: CourseRow): { id: UUID; name: string } | null {
  if (!row.workspace) return null;
  return Array.isArray(row.workspace) ? (row.workspace[0] ?? null) : row.workspace;
}

function sortCourseRows(rows: CourseRow[]) {
  rows.sort((a, b) => {
    const workspaceA = rowWorkspace(a)?.name ?? "";
    const workspaceB = rowWorkspace(b)?.name ?? "";
    const byWorkspace = workspaceA.localeCompare(workspaceB, "ko");
    if (byWorkspace !== 0) return byWorkspace;
    const byStatus = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    const byUpdated = b.updated_at.localeCompare(a.updated_at);
    if (byUpdated !== 0) return byUpdated;
    return b.created_at.localeCompare(a.created_at);
  });
}

function hasSupabaseAdminEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

function makeDemoSessions(
  startsOn: ISODate,
  startsAt: ISOTime,
  endsAt: ISOTime,
  count: number,
): PublicCourseSession[] {
  return Array.from({ length: count }, (_, index) => ({
    sessionNo: index + 1,
    date: addDays(startsOn, index * 7),
    startsAt,
    endsAt,
    type: index === count - 1 ? "special" : "regular",
    progressStatus: "scheduled",
  }));
}

function addDays(date: ISODate, days: number): ISODate {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

async function loadGroupNamesByCourse(
  courseIds: UUID[],
): Promise<Map<UUID, string[]>> {
  const result = new Map<UUID, string[]>();
  if (courseIds.length === 0) return result;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("course_groups")
    .select("course_id, group_name_snapshot")
    .in("course_id", courseIds);

  for (const row of data ?? []) {
    const courseId = row.course_id as UUID;
    const names = result.get(courseId) ?? [];
    if (row.group_name_snapshot) names.push(row.group_name_snapshot);
    result.set(courseId, names);
  }

  for (const names of result.values()) {
    names.sort((a, b) => a.localeCompare(b, "ko"));
  }
  return result;
}

async function loadVisibleSessionCounts(
  courseIds: UUID[],
): Promise<Map<UUID, number>> {
  const result = new Map<UUID, number>();
  if (courseIds.length === 0) return result;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("course_sessions")
    .select("course_id")
    .in("course_id", courseIds)
    .eq("visibility_status", "visible");

  for (const row of data ?? []) {
    const courseId = row.course_id as UUID;
    result.set(courseId, (result.get(courseId) ?? 0) + 1);
  }
  return result;
}

async function loadUploadedMaterialCounts(
  courseIds: UUID[],
): Promise<Map<UUID, number>> {
  const result = new Map<UUID, number>();
  if (courseIds.length === 0) return result;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("materials")
    .select("course_id")
    .in("course_id", courseIds)
    .eq("upload_status", "uploaded");

  for (const row of data ?? []) {
    const courseId = row.course_id as UUID;
    result.set(courseId, (result.get(courseId) ?? 0) + 1);
  }
  return result;
}

async function loadPublicSessions(courseId: UUID): Promise<PublicCourseSession[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("course_sessions")
    .select("session_no, date, starts_at, ends_at, type, progress_status")
    .eq("course_id", courseId)
    .eq("visibility_status", "visible")
    .order("date", { ascending: true })
    .order("starts_at", { ascending: true })
    .order("session_no", { ascending: true });

  return (data ?? []).map((row) => ({
    sessionNo: row.session_no,
    date: row.date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    type: row.type,
    progressStatus: row.progress_status,
  }));
}

async function loadPublicMaterials(courseId: UUID): Promise<PublicCourseMaterial[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("materials")
    .select("id, title, description, original_filename")
    .eq("course_id", courseId)
    .eq("upload_status", "uploaded")
    .eq("visibility_scope", "public")
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    originalFilename: row.original_filename,
  }));
}

/**
 * 비로그인 사용자도 호출 가능한 public 자료 다운로드 URL 발급.
 * 자료가 'public' visibility이고, 속한 수업이 'public' 공개 상태일 때만 URL을 반환한다.
 */
export async function getPublicMaterialDownloadUrl(
  materialId: UUID,
): Promise<ApiResult<{ url: string; filename: string | null }>> {
  if (String(materialId).startsWith("demo-material-")) {
    return apiError("NOT_FOUND", "목업 자료는 다운로드를 제공하지 않습니다.");
  }

  const admin = createSupabaseAdminClient();
  const { data: material } = await admin
    .from("materials")
    .select(
      "id, course_id, storage_path, original_filename, visibility_scope, upload_status",
    )
    .eq("id", materialId)
    .maybeSingle();
  if (!material) return apiError("NOT_FOUND", "자료를 찾을 수 없습니다.");
  if (material.visibility_scope !== "public") {
    return apiError("NOT_FOUND", "자료를 찾을 수 없습니다.");
  }
  if (material.upload_status !== "uploaded" || !material.storage_path) {
    return apiError("NOT_FOUND", "자료를 찾을 수 없습니다.");
  }

  const { data: course } = await admin
    .from("courses")
    .select("public_visibility")
    .eq("id", material.course_id)
    .maybeSingle();
  if (!course || course.public_visibility !== "public") {
    return apiError("NOT_FOUND", "자료를 찾을 수 없습니다.");
  }

  const { data: signed, error } = await admin.storage
    .from("course-materials")
    .createSignedUrl(material.storage_path, 60 * 60);
  if (error || !signed?.signedUrl) {
    return apiError(
      "INTERNAL_ERROR",
      error?.message ?? "다운로드 링크를 만들지 못했습니다.",
    );
  }
  return apiOk({ url: signed.signedUrl, filename: material.original_filename });
}

async function loadCourseAccessRow(
  workspaceId: UUID,
  courseId: UUID,
): Promise<{ id: UUID; instructor_member_id: UUID | null } | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("courses")
    .select("id, instructor_member_id")
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    instructor_member_id: data.instructor_member_id,
  };
}

async function canAccessCourseForMembership(input: {
  workspaceId: UUID;
  membership: CurrentMembership;
  course: { id: UUID; instructor_member_id: UUID | null };
}): Promise<boolean> {
  if (input.membership.role === "owner_admin") return true;
  if (
    input.membership.role === "instructor" &&
    input.course.instructor_member_id === input.membership.memberId
  ) {
    return true;
  }
  if (input.membership.role !== "group_admin") return false;

  const courseGroupIds = await loadCourseGroupIds(input.workspaceId, input.course.id);
  const accessibleGroupIds = await loadAccessibleGroupIds(input.workspaceId);
  return courseGroupIds.some((groupId) => accessibleGroupIds.has(groupId));
}

async function canManageFullCourseForMembership(input: {
  workspaceId: UUID;
  membership: CurrentMembership;
  courseId: UUID;
}): Promise<boolean> {
  if (input.membership.role === "owner_admin") return true;
  if (input.membership.role !== "group_admin") return false;

  const courseGroupIds = await loadCourseGroupIds(input.workspaceId, input.courseId);
  if (courseGroupIds.length === 0) return false;
  const accessibleGroupIds = await loadAccessibleGroupIds(input.workspaceId);
  return courseGroupIds.every((groupId) => accessibleGroupIds.has(groupId));
}

async function loadCourseGroupIds(
  workspaceId: UUID,
  courseId: UUID,
): Promise<UUID[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("course_groups")
    .select("group_id")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId);
  return (data ?? []).map((row) => row.group_id as UUID);
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
