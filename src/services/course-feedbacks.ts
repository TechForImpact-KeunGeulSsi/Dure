"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  CourseFeedbackCategory,
  CourseFeedbackListItem,
  CourseFeedbackStatus,
  UUID,
} from "@/lib/api/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CreateCourseFeedbackSchema,
  UpdateCourseFeedbackStatusSchema,
  type CreateCourseFeedbackInput,
  type UpdateCourseFeedbackStatusInput,
} from "@/lib/validators/course-feedback";
import { canAccessCourse, loadCurrentMembership } from "@/services/access";

import { logActivity } from "./activity";

const FEEDBACK_LIMIT = 100;

type FeedbackRow = {
  id: UUID;
  workspace_id: UUID;
  course_id: UUID;
  course_name_snapshot: string;
  category: CourseFeedbackCategory;
  message: string;
  author_name: string | null;
  author_phone: string | null;
  status: CourseFeedbackStatus;
  created_at: string;
  updated_at: string;
};

type CourseRow = {
  id: UUID;
  workspace_id: UUID;
  name: string;
  public_visibility?: "public" | "hidden";
  instructor_member_id: UUID | null;
};

export type GetCourseFeedbacksInput = {
  workspaceId: UUID;
  courseId?: UUID;
  category?: CourseFeedbackCategory;
  status?: CourseFeedbackStatus;
};

export type GetCourseFeedbacksOutput = {
  feedbacks: CourseFeedbackListItem[];
  courseOptions: Array<{ id: UUID; name: string }>;
  counts: {
    new: number;
    reviewed: number;
  };
  canDelete: boolean;
};

export async function createCourseFeedback(
  courseId: UUID,
  rawInput: CreateCourseFeedbackInput,
): Promise<ApiResult<{ id: UUID }>> {
  const parsed = CreateCourseFeedbackSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }

  const admin = createSupabaseAdminClient();
  const { data: course, error: courseError } = await admin
    .from("courses")
    .select("id, workspace_id, name, public_visibility, instructor_member_id")
    .eq("id", courseId)
    .eq("public_visibility", "public")
    .maybeSingle();
  if (courseError) return apiError("INTERNAL_ERROR", courseError.message);
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const now = new Date().toISOString();
  const { data: inserted, error } = await admin
    .from("course_feedbacks")
    .insert({
      workspace_id: course.workspace_id,
      course_id: course.id,
      course_name_snapshot: course.name,
      category: parsed.data.category,
      message: parsed.data.message,
      author_name: parsed.data.authorName ?? null,
      author_phone: parsed.data.authorPhone ?? null,
      status: "new",
      privacy_consent_at: now,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return apiError(
      "INTERNAL_ERROR",
      error?.message ?? "의견을 저장하지 못했습니다.",
    );
  }

  await logActivity({
    workspaceId: course.workspace_id,
    actorMemberId: null,
    eventType: "course_feedback_created",
    targetType: "course_feedback",
    targetId: inserted.id,
    metadata: {
      courseId: course.id,
      courseName: course.name,
      category: parsed.data.category,
      preview: makePreview(parsed.data.message),
    },
  });

  revalidatePath(`/workspaces/${course.workspace_id}/feedback`);
  return apiOk({ id: inserted.id });
}

export async function getCourseFeedbacks(
  input: GetCourseFeedbacksInput,
): Promise<ApiResult<GetCourseFeedbacksOutput>> {
  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "의견 수렴 페이지에 접근할 수 없습니다.");
  }

  const admin = createSupabaseAdminClient();
  const accessibleCourseIds =
    membership.role === "owner_admin"
      ? null
      : await loadAccessibleCourseIds(input.workspaceId);

  if (accessibleCourseIds && accessibleCourseIds.length === 0) {
    return apiOk({
      feedbacks: [],
      courseOptions: [],
      counts: { new: 0, reviewed: 0 },
      canDelete: false,
    });
  }

  let query = admin
    .from("course_feedbacks")
    .select(
      "id, workspace_id, course_id, course_name_snapshot, category, message, author_name, author_phone, status, created_at, updated_at",
    )
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false })
    .limit(FEEDBACK_LIMIT);

  if (accessibleCourseIds) query = query.in("course_id", accessibleCourseIds);
  if (input.courseId) query = query.eq("course_id", input.courseId);
  if (input.category) query = query.eq("category", input.category);
  if (input.status) query = query.eq("status", input.status);

  const { data, error } = await query;
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const rows = (data ?? []) as FeedbackRow[];
  const canDelete = membership.role === "owner_admin";
  const feedbacks = rows.map((row) => toListItem(row, canDelete));

  return apiOk({
    feedbacks,
    courseOptions: buildCourseOptions(rows),
    counts: countByStatus(rows),
    canDelete,
  });
}

export async function updateCourseFeedbackStatus(
  workspaceId: UUID,
  feedbackId: UUID,
  rawInput: UpdateCourseFeedbackStatusInput,
): Promise<ApiResult<{ feedback: CourseFeedbackListItem }>> {
  const parsed = UpdateCourseFeedbackStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }

  const access = await loadFeedbackWithAccess(workspaceId, feedbackId);
  if (!access.ok) return access;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("course_feedbacks")
    .update({ status: parsed.data.status })
    .eq("workspace_id", workspaceId)
    .eq("id", feedbackId)
    .select(
      "id, workspace_id, course_id, course_name_snapshot, category, message, author_name, author_phone, status, created_at, updated_at",
    )
    .single();
  if (error || !data) {
    return apiError(
      "INTERNAL_ERROR",
      error?.message ?? "의견 상태를 변경하지 못했습니다.",
    );
  }

  revalidatePath(`/workspaces/${workspaceId}/feedback`);
  return apiOk({
    feedback: toListItem(data as FeedbackRow, access.data.membership.role === "owner_admin"),
  });
}

export async function deleteCourseFeedback(
  workspaceId: UUID,
  feedbackId: UUID,
): Promise<ApiResult<{ id: UUID }>> {
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role !== "owner_admin") {
    return apiError("ROLE_FORBIDDEN", "의견 삭제는 대표 운영자만 할 수 있습니다.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("course_feedbacks")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", feedbackId);
  if (error) return apiError("INTERNAL_ERROR", error.message);

  revalidatePath(`/workspaces/${workspaceId}/feedback`);
  return apiOk({ id: feedbackId });
}

async function loadFeedbackWithAccess(workspaceId: UUID, feedbackId: UUID) {
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role === "instructor") {
    return apiError("ROLE_FORBIDDEN", "의견 상태를 변경할 수 없습니다.");
  }

  const admin = createSupabaseAdminClient();
  const { data: feedback, error } = await admin
    .from("course_feedbacks")
    .select("id, course_id")
    .eq("workspace_id", workspaceId)
    .eq("id", feedbackId)
    .maybeSingle();
  if (error) return apiError("INTERNAL_ERROR", error.message);
  if (!feedback) return apiError("NOT_FOUND", "의견을 찾을 수 없습니다.");

  const { data: course, error: courseError } = await admin
    .from("courses")
    .select("id, workspace_id, name, instructor_member_id")
    .eq("workspace_id", workspaceId)
    .eq("id", feedback.course_id)
    .maybeSingle();
  if (courseError) return apiError("INTERNAL_ERROR", courseError.message);
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const allowed = await canAccessCourse({
    workspaceId,
    membership,
    course: course as CourseRow,
  });
  if (!allowed) {
    return apiError("SCOPE_FORBIDDEN", "해당 수업 의견에 접근할 수 없습니다.");
  }

  return apiOk({ membership });
}

async function loadAccessibleCourseIds(workspaceId: UUID): Promise<UUID[]> {
  const admin = createSupabaseAdminClient();
  const { data: groupRows } = await admin.rpc("accessible_group_ids", {
    target_workspace_id: workspaceId,
  });
  const groupIds = Array.isArray(groupRows)
    ? groupRows
        .map((row) =>
          typeof row === "string" ? row : row.accessible_group_ids,
        )
        .filter((id): id is UUID => typeof id === "string" && id.length > 0)
    : [];
  if (groupIds.length === 0) return [];

  const { data: courseRows } = await admin
    .from("course_groups")
    .select("course_id")
    .eq("workspace_id", workspaceId)
    .in("group_id", groupIds);
  return Array.from(
    new Set((courseRows ?? []).map((row) => row.course_id as UUID)),
  );
}

function toListItem(
  row: FeedbackRow,
  canDelete: boolean,
): CourseFeedbackListItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    courseId: row.course_id,
    courseName: row.course_name_snapshot,
    category: row.category,
    status: row.status,
    message: row.message,
    authorName: row.author_name,
    authorPhone: row.author_phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canUpdateStatus: true,
    canDelete,
  };
}

function buildCourseOptions(rows: FeedbackRow[]) {
  const map = new Map<UUID, string>();
  for (const row of rows) {
    if (!map.has(row.course_id)) map.set(row.course_id, row.course_name_snapshot);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function countByStatus(rows: FeedbackRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { new: 0, reviewed: 0 } satisfies Record<CourseFeedbackStatus, number>,
  );
}

function makePreview(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, " ");
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed;
}

function collectFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]),
    ),
  );
}
