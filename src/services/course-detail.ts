"use server";

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type {
  CourseStatus,
  GroupSummary,
  InstructorSummary,
  UUID,
} from "@/lib/api/types";

export type CourseDetail = {
  id: UUID;
  name: string;
  status: CourseStatus;
  startsOn: string | null;
  endsOn: string | null;
  cardColor: string | null;
  bannerUrl: string | null;
  groups: GroupSummary[];
  instructor: InstructorSummary | null;
  canUpdateVisuals: boolean;
};

/** api-spec.md §10.1 — 수업 상세 헤더용 코스 정보 조회. */
export async function getCourseDetail(
  workspaceId: UUID,
  courseId: UUID,
): Promise<ApiResult<CourseDetail>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: course, error } = await supabase
    .from("courses")
    .select(
      "id, name, status, starts_on, ends_on, card_color, banner_url, instructor_member_id",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", courseId)
    .maybeSingle();

  if (error) return apiError("INTERNAL_ERROR", error.message);
  if (!course) return apiError("NOT_FOUND", "수업을 찾을 수 없습니다.");

  const [groups, instructor, canUpdateVisuals] = await Promise.all([
    loadCourseGroups(workspaceId, courseId),
    course.instructor_member_id
      ? loadInstructor(course.instructor_member_id)
      : Promise.resolve(null),
    canManageFullCourseRpc(courseId),
  ]);

  return apiOk({
    id: course.id,
    name: course.name,
    status: course.status,
    startsOn: course.starts_on,
    endsOn: course.ends_on,
    cardColor: course.card_color,
    bannerUrl: course.banner_url,
    groups,
    instructor,
    canUpdateVisuals,
  });
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

async function canManageFullCourseRpc(courseId: UUID): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("can_manage_full_course", {
    target_course_id: courseId,
  });
  return data === true;
}