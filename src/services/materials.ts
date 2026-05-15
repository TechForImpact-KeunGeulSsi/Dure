"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  CourseStatus,
  GroupSummary,
  InstructorSummary,
  MaterialListItem,
  MaterialReviewStatus,
  MemberSummary,
  UUID,
} from "@/lib/api/types";
import {
  MATERIAL_ALLOWED_EXTENSIONS,
  MATERIAL_ALLOWED_MIME_TYPES,
  MATERIAL_MAX_SIZE_BYTES,
  PrepareMaterialUploadSchema,
  ReplaceMaterialFileSchema,
  UpdateMaterialReviewStatusSchema,
  UpdateMaterialSchema,
  safeFilename,
  validateUploadPolicy,
  type PrepareMaterialUploadInput,
  type ReplaceMaterialFileInput,
  type UpdateMaterialInput,
  type UpdateMaterialReviewStatusInput,
} from "@/lib/validators/material";

const BUCKET = "course-materials";
const SIGNED_UPLOAD_EXPIRES_SECONDS = 60 * 10; // 10분
const SIGNED_DOWNLOAD_EXPIRES_SECONDS = 60 * 60; // 1시간

// Public API (api-spec.md §11)

type GetCourseMaterialsInput = {
  workspaceId: UUID;
  courseId: UUID;
  reviewStatus?: MaterialReviewStatus;
};

export type CourseSummaryForMaterials = {
  id: UUID;
  name: string;
  status: CourseStatus;
  startsOn: string | null;
  endsOn: string | null;
  cardColor: string | null;
  bannerUrl: string | null;
  groups: GroupSummary[];
  instructor: InstructorSummary | null;
};

export type GetCourseMaterialsOutput = {
  course: CourseSummaryForMaterials;
  materials: MaterialListItem[];
  uploadPolicy: {
    maxSizeBytes: 52428800;
    allowedExtensions: string[];
    allowedMimeTypes: string[];
  };
  canCreateMaterial: boolean;
};

// api-spec.md §11.1
export async function getCourseMaterials(
  input: GetCourseMaterialsInput,
): Promise<ApiResult<GetCourseMaterialsOutput>> {
  await requireUser();
  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const course = await loadCourseForMaterials(input.workspaceId, input.courseId);
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const materials = await loadMaterialListItems({
    workspaceId: input.workspaceId,
    courseId: input.courseId,
    reviewStatus: input.reviewStatus,
    membership,
    isCourseInstructor: course.instructor?.id === membership.memberId,
  });

  return apiOk({
    course,
    materials,
    uploadPolicy: {
      maxSizeBytes: MATERIAL_MAX_SIZE_BYTES,
      allowedExtensions: [...MATERIAL_ALLOWED_EXTENSIONS],
      allowedMimeTypes: [...MATERIAL_ALLOWED_MIME_TYPES],
    },
    canCreateMaterial: canUploadForRole(membership.role),
  });
}

type PrepareMaterialUploadRawInput = PrepareMaterialUploadInput & {
  workspaceId: UUID;
  courseId: UUID;
};

export type PrepareMaterialUploadOutput = {
  materialId: UUID;
  storagePath: string;
  signedUploadUrl: string;
  expiresAt: string;
};

// api-spec.md §11.2
export async function prepareMaterialUpload(
  input: PrepareMaterialUploadRawInput,
): Promise<ApiResult<PrepareMaterialUploadOutput>> {
  const parsed = PrepareMaterialUploadSchema.safeParse(input);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }

  const policy = validateUploadPolicy(parsed.data);
  if (!policy.ok) {
    return apiError("UPLOAD_POLICY_VIOLATION", policy.message, {
      fieldErrors: { [policy.field]: [policy.message] },
    });
  }

  await requireUser();
  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (!canUploadForRole(membership.role)) {
    return apiError("ROLE_FORBIDDEN", "자료 업로드 권한이 없습니다.");
  }

  return createMaterialAndIssueUploadUrl(
    input.workspaceId,
    input.courseId,
    parsed.data,
    membership,
  );
}

// api-spec.md §11.3
export async function completeMaterialUpload(
  workspaceId: UUID,
  materialId: UUID,
): Promise<ApiResult<{ material: MaterialListItem }>> {
  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const row = await loadMaterialBasicRow(workspaceId, materialId);
  if (!row) return apiError("NOT_FOUND", "자료를 찾을 수 없습니다.");
  if (!row.storage_path) {
    return apiError("CONFLICT", "업로드 경로가 아직 만들어지지 않았습니다.");
  }

  const allowed = await canEditMaterial({ workspaceId, membership, row });
  if (!allowed) return apiError("SCOPE_FORBIDDEN", "자료를 수정할 권한이 없습니다.");

  const exists = await storageObjectExists(row.storage_path);
  if (!exists) {
    return apiError("CONFLICT", "업로드된 파일을 확인할 수 없습니다. 다시 시도해 주세요.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("materials")
    .update({ upload_status: "uploaded" })
    .eq("workspace_id", workspaceId)
    .eq("id", materialId);
  if (error) return apiError("INTERNAL_ERROR", error.message);

  return refetchMaterialListItem(workspaceId, row.course_id, materialId, membership);
}

// api-spec.md §11.4
export async function updateMaterial(
  workspaceId: UUID,
  materialId: UUID,
  rawInput: UpdateMaterialInput,
): Promise<ApiResult<{ material: MaterialListItem }>> {
  const parsed = UpdateMaterialSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const row = await loadMaterialBasicRow(workspaceId, materialId);
  if (!row) return apiError("NOT_FOUND", "자료를 찾을 수 없습니다.");

  const allowed = await canEditMaterial({ workspaceId, membership, row });
  if (!allowed) return apiError("SCOPE_FORBIDDEN", "자료를 수정할 권한이 없습니다.");

  const writeError = await writeMaterialUpdates(workspaceId, row, parsed.data);
  if (writeError) return writeError;

  return refetchMaterialListItem(workspaceId, row.course_id, materialId, membership);
}

export type ReplaceMaterialFileOutput = {
  storagePath: string;
  signedUploadUrl: string;
  expiresAt: string;
};

// api-spec.md §11.5
export async function replaceMaterialFile(
  workspaceId: UUID,
  materialId: UUID,
  rawInput: ReplaceMaterialFileInput,
): Promise<ApiResult<ReplaceMaterialFileOutput>> {
  const parsed = ReplaceMaterialFileSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }
  const policy = validateUploadPolicy(parsed.data);
  if (!policy.ok) {
    return apiError("UPLOAD_POLICY_VIOLATION", policy.message, {
      fieldErrors: { [policy.field]: [policy.message] },
    });
  }

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const row = await loadMaterialBasicRow(workspaceId, materialId);
  if (!row) return apiError("NOT_FOUND", "자료를 찾을 수 없습니다.");

  const allowed = await canEditMaterial({ workspaceId, membership, row });
  if (!allowed) return apiError("SCOPE_FORBIDDEN", "자료를 수정할 권한이 없습니다.");

  return issueReplacementUploadUrl(workspaceId, row.course_id, materialId, parsed.data);
}

// api-spec.md §11.6
export async function updateMaterialReviewStatus(
  workspaceId: UUID,
  materialId: UUID,
  rawInput: UpdateMaterialReviewStatusInput,
): Promise<ApiResult<{ material: MaterialListItem }>> {
  const parsed = UpdateMaterialReviewStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }

  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사는 확인 상태를 변경할 수 없습니다.");
  }

  const row = await loadMaterialBasicRow(workspaceId, materialId);
  if (!row) return apiError("NOT_FOUND", "자료를 찾을 수 없습니다.");

  const allowed = await canChangeReviewStatus({ workspaceId, membership, row });
  if (!allowed) return apiError("SCOPE_FORBIDDEN", "해당 자료의 확인 상태를 변경할 권한이 없습니다.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("materials")
    .update({ review_status: parsed.data.reviewStatus })
    .eq("workspace_id", workspaceId)
    .eq("id", materialId);
  if (error) return apiError("INTERNAL_ERROR", error.message);

  return refetchMaterialListItem(workspaceId, row.course_id, materialId, membership);
}

export type GetMaterialDownloadUrlOutput = {
  signedDownloadUrl: string;
  expiresAt: string;
  originalFilename: string | null;
};

// api-spec.md §11.7
export async function getMaterialDownloadUrl(
  workspaceId: UUID,
  materialId: UUID,
): Promise<ApiResult<GetMaterialDownloadUrlOutput>> {
  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const row = await loadMaterialBasicRow(workspaceId, materialId);
  if (!row) return apiError("NOT_FOUND", "자료를 찾을 수 없습니다.");
  if (!row.storage_path) return apiError("CONFLICT", "아직 업로드되지 않은 자료입니다.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_DOWNLOAD_EXPIRES_SECONDS, {
      download: row.original_filename ?? undefined,
    });
  if (error || !data) {
    return apiError("INTERNAL_ERROR", error?.message ?? "다운로드 URL을 발급하지 못했습니다.");
  }

  return apiOk({
    signedDownloadUrl: data.signedUrl,
    expiresAt: new Date(Date.now() + SIGNED_DOWNLOAD_EXPIRES_SECONDS * 1000).toISOString(),
    originalFilename: row.original_filename,
  });
}

// internal helpers

type CurrentMembership = {
  memberId: UUID;
  role: "owner_admin" | "group_admin" | "instructor";
};

async function loadCurrentMembership(
  workspaceId: UUID,
): Promise<CurrentMembership | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return { memberId: data.id, role: data.role };
}

function canUploadForRole(role: CurrentMembership["role"]): boolean {
  return role === "owner_admin" || role === "group_admin" || role === "instructor";
}

async function loadCourseForMaterials(
  workspaceId: UUID,
  courseId: UUID,
): Promise<CourseSummaryForMaterials | null> {
  const supabase = await createSupabaseServerClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, name, status, starts_on, ends_on, card_color, banner_url, instructor_member_id")
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return null;

  const [groups, instructor] = await Promise.all([
    loadCourseGroups(workspaceId, courseId),
    course.instructor_member_id
      ? loadInstructor(course.instructor_member_id)
      : Promise.resolve(null),
  ]);

  return {
    id: course.id,
    name: course.name,
    status: course.status,
    startsOn: course.starts_on,
    endsOn: course.ends_on,
    cardColor: course.card_color,
    bannerUrl: course.banner_url,
    groups,
    instructor,
  };
}

async function loadCourseGroups(workspaceId: UUID, courseId: UUID): Promise<GroupSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_groups")
    .select("group:groups ( id, name, description, status )")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId);

  const groups: GroupSummary[] = [];
  for (const row of data ?? []) {
    const g = row.group as unknown as GroupSummary | null;
    if (g) groups.push(g);
  }
  return groups;
}

async function loadInstructor(memberId: UUID): Promise<InstructorSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("id, email, display_name, status")
    .eq("id", memberId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    status: data.status,
  };
}

type MaterialRow = {
  id: UUID;
  course_id: UUID;
  title: string;
  description: string | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: UUID | null;
  upload_status: "uploading" | "uploaded" | "failed";
  review_status: MaterialReviewStatus;
  visibility_scope: "all_course_groups" | "selected_groups";
  storage_path: string | null;
  created_at: string;
  updated_at: string;
};

type MaterialBasicRow = Pick<
  MaterialRow,
  "id" | "course_id" | "storage_path" | "original_filename" | "uploaded_by" | "visibility_scope"
>;

async function loadMaterialBasicRow(
  workspaceId: UUID,
  materialId: UUID,
): Promise<MaterialBasicRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("materials")
    .select("id, course_id, storage_path, original_filename, uploaded_by, visibility_scope")
    .eq("workspace_id", workspaceId)
    .eq("id", materialId)
    .maybeSingle();
  return data
    ? {
        id: data.id,
        course_id: data.course_id,
        storage_path: data.storage_path,
        original_filename: data.original_filename,
        uploaded_by: data.uploaded_by,
        visibility_scope: data.visibility_scope,
      }
    : null;
}

async function loadMaterialListItems(params: {
  workspaceId: UUID;
  courseId: UUID;
  reviewStatus?: MaterialReviewStatus;
  membership: CurrentMembership;
  isCourseInstructor: boolean;
}): Promise<MaterialListItem[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("materials")
    .select(
      "id, course_id, title, description, original_filename, mime_type, size_bytes, uploaded_by, upload_status, review_status, visibility_scope, storage_path, created_at, updated_at",
    )
    .eq("workspace_id", params.workspaceId)
    .eq("course_id", params.courseId)
    .order("created_at", { ascending: false });
  if (params.reviewStatus) q = q.eq("review_status", params.reviewStatus);

  const { data } = await q;
  const rows = (data ?? []) as MaterialRow[];
  if (rows.length === 0) return [];

  const [groupsByMaterial, uploaders, accessibleGroupIds] = await Promise.all([
    loadVisibleGroupsByMaterial(
      params.workspaceId,
      rows.map((r) => r.id),
    ),
    loadUploaders(rows.map((r) => r.uploaded_by).filter((v): v is UUID => !!v)),
    params.membership.role === "group_admin"
      ? loadAccessibleGroupIds(params.workspaceId)
      : Promise.resolve(new Set<UUID>()),
  ]);

  return rows.map((row) =>
    toMaterialListItem(row, {
      visibleGroups: groupsByMaterial.get(row.id) ?? [],
      uploader: row.uploaded_by ? uploaders.get(row.uploaded_by) ?? null : null,
      membership: params.membership,
      isCourseInstructor: params.isCourseInstructor,
      accessibleGroupIds,
    }),
  );
}

async function loadVisibleGroupsByMaterial(
  workspaceId: UUID,
  materialIds: UUID[],
): Promise<Map<UUID, GroupSummary[]>> {
  const result = new Map<UUID, GroupSummary[]>();
  if (materialIds.length === 0) return result;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("material_groups")
    .select("material_id, group:groups ( id, name, description, status )")
    .eq("workspace_id", workspaceId)
    .in("material_id", materialIds);

  for (const row of data ?? []) {
    const g = row.group as unknown as GroupSummary | null;
    if (!g) continue;
    const arr = result.get(row.material_id as UUID) ?? [];
    arr.push(g);
    result.set(row.material_id as UUID, arr);
  }
  return result;
}

async function loadUploaders(memberIds: UUID[]): Promise<Map<UUID, MemberSummary>> {
  const result = new Map<UUID, MemberSummary>();
  if (memberIds.length === 0) return result;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("id, email, display_name, role, status")
    .in("id", Array.from(new Set(memberIds)));
  for (const row of data ?? []) {
    result.set(row.id as UUID, {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
    });
  }
  return result;
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
  return new Set(ids.filter((v) => v.length > 0));
}

function toMaterialListItem(
  row: MaterialRow,
  ctx: {
    visibleGroups: GroupSummary[];
    uploader: MemberSummary | null;
    membership: CurrentMembership;
    isCourseInstructor: boolean;
    accessibleGroupIds: Set<UUID>;
  },
): MaterialListItem {
  const flags = computeMaterialPermissionFlags(row, ctx);
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedBy: ctx.uploader,
    uploadStatus: row.upload_status,
    reviewStatus: row.review_status,
    visibilityScope: row.visibility_scope,
    visibleGroups: ctx.visibleGroups,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...flags,
  };
}

function computeMaterialPermissionFlags(
  row: MaterialRow,
  ctx: {
    visibleGroups: GroupSummary[];
    membership: CurrentMembership;
    isCourseInstructor: boolean;
    accessibleGroupIds: Set<UUID>;
  },
): Pick<MaterialListItem, "canEdit" | "canReplaceFile" | "canChangeReviewStatus" | "canDownload"> {
  const isOwner = ctx.membership.role === "owner_admin";
  const isUploader = row.uploaded_by === ctx.membership.memberId;
  const groupAdminOverlap =
    ctx.membership.role === "group_admin" &&
    ctx.visibleGroups.some((g) => ctx.accessibleGroupIds.has(g.id));

  const canEdit = isOwner || isUploader || groupAdminOverlap;
  const canChangeReviewStatus =
    isOwner || (ctx.membership.role === "group_admin" && groupAdminOverlap);

  return {
    canEdit,
    canReplaceFile: canEdit,
    canChangeReviewStatus,
    canDownload: true, // RLS를 통과해서 보이는 자료면 다운로드 가능
  };
}

// permission helpers (server)

async function canEditMaterial(params: {
  workspaceId: UUID;
  membership: CurrentMembership;
  row: MaterialBasicRow;
}): Promise<boolean> {
  if (params.membership.role === "owner_admin") return true;
  if (params.row.uploaded_by === params.membership.memberId) return true;
  if (params.membership.role !== "group_admin") return false;

  const accessible = await loadAccessibleGroupIds(params.workspaceId);
  if (accessible.size === 0) return false;
  return hasGroupOverlap({
    workspaceId: params.workspaceId,
    row: params.row,
    accessibleGroupIds: accessible,
  });
}

async function canChangeReviewStatus(params: {
  workspaceId: UUID;
  membership: CurrentMembership;
  row: MaterialBasicRow;
}): Promise<boolean> {
  if (params.membership.role === "owner_admin") return true;
  if (params.membership.role !== "group_admin") return false;

  const accessible = await loadAccessibleGroupIds(params.workspaceId);
  if (accessible.size === 0) return false;
  return hasGroupOverlap({
    workspaceId: params.workspaceId,
    row: params.row,
    accessibleGroupIds: accessible,
  });
}

// 자료 공개 범위와 사용자 접근 그룹이 교차하는지, all_course_groups면 수업 연결 그룹 기준
async function hasGroupOverlap(params: {
  workspaceId: UUID;
  row: Pick<MaterialBasicRow, "id" | "course_id" | "visibility_scope">;
  accessibleGroupIds: Set<UUID>;
}): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  if (params.row.visibility_scope === "all_course_groups") {
    const { data } = await supabase
      .from("course_groups")
      .select("group_id")
      .eq("workspace_id", params.workspaceId)
      .eq("course_id", params.row.course_id);
    return (data ?? []).some((r) => params.accessibleGroupIds.has(r.group_id as UUID));
  }
  const { data } = await supabase
    .from("material_groups")
    .select("group_id")
    .eq("workspace_id", params.workspaceId)
    .eq("material_id", params.row.id);
  return (data ?? []).some((r) => params.accessibleGroupIds.has(r.group_id as UUID));
}

// upload preparation helpers

async function createMaterialAndIssueUploadUrl(
  workspaceId: UUID,
  courseId: UUID,
  data: PrepareMaterialUploadInput,
  membership: CurrentMembership,
): Promise<ApiResult<PrepareMaterialUploadOutput>> {
  if (data.visibilityScope === "selected_groups") {
    const ok = await assertGroupsBelongToCourse(workspaceId, courseId, data.visibleGroupIds ?? []);
    if (!ok) {
      return apiError("VALIDATION_FAILED", "공개 그룹은 해당 수업의 연결 그룹이어야 합니다.");
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data: inserted, error: insertError } = await supabase
    .from("materials")
    .insert({
      workspace_id: workspaceId,
      course_id: courseId,
      title: data.title,
      description: data.description ?? null,
      original_filename: data.originalFilename,
      mime_type: data.mimeType,
      size_bytes: data.sizeBytes,
      uploaded_by: membership.memberId,
      upload_status: "uploading",
      review_status: "pending",
      visibility_scope: data.visibilityScope,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return apiError("INTERNAL_ERROR", insertError?.message ?? "자료 레코드를 만들지 못했습니다.");
  }
  const materialId: UUID = inserted.id;

  if (data.visibilityScope === "selected_groups" && data.visibleGroupIds?.length) {
    const groupsInsert = await insertMaterialGroups(workspaceId, materialId, data.visibleGroupIds);
    if (!groupsInsert.ok) return groupsInsert.error;
  }

  const storagePath = buildStoragePath(workspaceId, courseId, materialId, data.originalFilename);
  const { error: pathError } = await supabase
    .from("materials")
    .update({ storage_path: storagePath })
    .eq("workspace_id", workspaceId)
    .eq("id", materialId);
  if (pathError) return apiError("INTERNAL_ERROR", pathError.message);

  const signed = await issueSignedUploadUrl(storagePath);
  if (!signed.ok) return signed.error;

  revalidatePath(`/workspaces/${workspaceId}/courses/${courseId}/materials`);
  return apiOk({
    materialId,
    storagePath,
    signedUploadUrl: signed.url,
    expiresAt: signed.expiresAt,
  });
}

async function issueReplacementUploadUrl(
  workspaceId: UUID,
  courseId: UUID,
  materialId: UUID,
  data: ReplaceMaterialFileInput,
): Promise<ApiResult<ReplaceMaterialFileOutput>> {
  const storagePath = buildStoragePath(workspaceId, courseId, materialId, data.originalFilename);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("materials")
    .update({
      storage_path: storagePath,
      original_filename: data.originalFilename,
      mime_type: data.mimeType,
      size_bytes: data.sizeBytes,
      upload_status: "uploading",
      // review_status는 트리거 reset_material_review_status 가 자동으로 'pending'으로 변경
    })
    .eq("workspace_id", workspaceId)
    .eq("id", materialId);
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const signed = await issueSignedUploadUrl(storagePath);
  if (!signed.ok) return signed.error;

  revalidatePath(`/workspaces/${workspaceId}/courses/${courseId}/materials`);
  return apiOk({
    storagePath,
    signedUploadUrl: signed.url,
    expiresAt: signed.expiresAt,
  });
}

function buildStoragePath(
  workspaceId: UUID,
  courseId: UUID,
  materialId: UUID,
  originalFilename: string,
): string {
  const fileId = randomUUID();
  const safe = safeFilename(originalFilename);
  return `workspaces/${workspaceId}/courses/${courseId}/materials/${materialId}/${fileId}-${safe}`;
}

async function issueSignedUploadUrl(
  storagePath: string,
): Promise<{ ok: true; url: string; expiresAt: string } | { ok: false; error: ApiResult<never> }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) {
    return {
      ok: false,
      error: apiError("INTERNAL_ERROR", error?.message ?? "업로드 URL을 발급하지 못했습니다."),
    };
  }
  return {
    ok: true,
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + SIGNED_UPLOAD_EXPIRES_SECONDS * 1000).toISOString(),
  };
}

async function insertMaterialGroups(
  workspaceId: UUID,
  materialId: UUID,
  groupIds: UUID[],
): Promise<{ ok: true } | { ok: false; error: ApiResult<never> }> {
  // RLS는 full course admin/owner만 가능, 강사 업로드 케이스 위해 admin client
  // DB 트리거 ensure_material_group_is_course_group 이 그룹 정합성 강제
  const admin = createSupabaseAdminClient();
  const rows = groupIds.map((groupId) => ({
    workspace_id: workspaceId,
    material_id: materialId,
    group_id: groupId,
  }));
  const { error } = await admin.from("material_groups").insert(rows);
  if (error) return { ok: false, error: apiError("INTERNAL_ERROR", error.message) };
  return { ok: true };
}

async function deleteAllMaterialGroups(workspaceId: UUID, materialId: UUID): Promise<ApiResult<never> | null> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("material_groups")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("material_id", materialId);
  if (error) return apiError("INTERNAL_ERROR", error.message);
  return null;
}

async function assertGroupsBelongToCourse(
  workspaceId: UUID,
  courseId: UUID,
  groupIds: UUID[],
): Promise<boolean> {
  if (groupIds.length === 0) return false;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("course_groups")
    .select("group_id")
    .eq("workspace_id", workspaceId)
    .eq("course_id", courseId)
    .in("group_id", groupIds);
  const found = new Set((data ?? []).map((r) => r.group_id as UUID));
  return groupIds.every((id) => found.has(id));
}

async function storageObjectExists(storagePath: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const slash = storagePath.lastIndexOf("/");
  const folder = slash >= 0 ? storagePath.slice(0, slash) : "";
  const filename = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;
  const { data } = await admin.storage.from(BUCKET).list(folder, { search: filename, limit: 1 });
  return (data ?? []).some((entry) => entry.name === filename);
}

// update helpers

async function writeMaterialUpdates(
  workspaceId: UUID,
  row: MaterialBasicRow,
  input: UpdateMaterialInput,
): Promise<ApiResult<never> | null> {
  const newScope = input.visibilityScope ?? row.visibility_scope;
  const wantsGroupChange =
    input.visibilityScope !== undefined || input.visibleGroupIds !== undefined;

  if (wantsGroupChange && newScope === "selected_groups") {
    const groupIds = input.visibleGroupIds;
    if (!groupIds || groupIds.length === 0) {
      return apiError("VALIDATION_FAILED", "공개 그룹을 1개 이상 선택해 주세요.");
    }
    const valid = await assertGroupsBelongToCourse(workspaceId, row.course_id, groupIds);
    if (!valid) {
      return apiError("VALIDATION_FAILED", "공개 그룹은 해당 수업의 연결 그룹이어야 합니다.");
    }
  }

  const supabase = await createSupabaseServerClient();
  const updatePayload: Record<string, unknown> = {};
  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.description !== undefined) updatePayload.description = input.description ?? null;
  if (input.visibilityScope !== undefined) updatePayload.visibility_scope = input.visibilityScope;
  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase
      .from("materials")
      .update(updatePayload)
      .eq("workspace_id", workspaceId)
      .eq("id", row.id);
    if (error) return apiError("INTERNAL_ERROR", error.message);
  }

  if (!wantsGroupChange) return null;
  return rewriteMaterialGroups(workspaceId, row.id, newScope, input.visibleGroupIds ?? []);
}

async function rewriteMaterialGroups(
  workspaceId: UUID,
  materialId: UUID,
  newScope: "all_course_groups" | "selected_groups",
  groupIds: UUID[],
): Promise<ApiResult<never> | null> {
  const deleted = await deleteAllMaterialGroups(workspaceId, materialId);
  if (deleted) return deleted;

  if (newScope !== "selected_groups" || groupIds.length === 0) return null;
  const inserted = await insertMaterialGroups(workspaceId, materialId, groupIds);
  if (!inserted.ok) return inserted.error;
  return null;
}

// refetch helpers

async function refetchMaterialListItem(
  workspaceId: UUID,
  courseId: UUID,
  materialId: UUID,
  membership: CurrentMembership,
): Promise<ApiResult<{ material: MaterialListItem }>> {
  const isInstructor = await isInstructorOfCourse(workspaceId, courseId, membership.memberId);
  const items = await loadMaterialListItems({
    workspaceId,
    courseId,
    membership,
    isCourseInstructor: isInstructor,
  });
  const found = items.find((m) => m.id === materialId);
  if (!found) return apiError("NOT_FOUND", "자료를 찾을 수 없습니다.");
  revalidatePath(`/workspaces/${workspaceId}/courses/${courseId}/materials`);
  return apiOk({ material: found });
}

async function isInstructorOfCourse(
  workspaceId: UUID,
  courseId: UUID,
  memberId: UUID,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("courses")
    .select("instructor_member_id")
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();
  return !!data && data.instructor_member_id === memberId;
}

function collectFieldErrors(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    (result[path] ??= []).push(issue.message);
  }
  return result;
}