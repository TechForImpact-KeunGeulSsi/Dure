import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { getCourseEditData } from "@/services/courses";

import { EditCourseForm } from "./edit-course-form";

type EditCoursePageProps = {
  params: Promise<{ workspaceId: string; courseId: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function EditCoursePage({
  params,
  searchParams,
}: EditCoursePageProps) {
  const { workspaceId, courseId } = await params;
  const { returnTo } = await searchParams;
  const returnHref = normalizeReturnHref(workspaceId, returnTo);
  const result = await getCourseEditData({ workspaceId, courseId });

  if (!result.ok) {
    if (result.error.code === "WORKSPACE_ACCESS_DENIED") {
      redirect("/workspaces");
    }
    if (result.error.code === "ROLE_FORBIDDEN") {
      redirect(`/workspaces/${workspaceId}/home`);
    }
    return (
      <EmptyState
        title="수업 정보를 불러오지 못했습니다"
        description={result.error.message}
      />
    );
  }

  if (!result.data.canManageFullCourse) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="수정 권한이 없습니다"
          description="이 수업의 모든 연결 그룹에 접근할 수 있는 운영자만 정보를 수정할 수 있습니다."
        />
        <div className="text-center">
          <Link
            href={`/workspaces/${workspaceId}/manage/courses`}
            className="text-sm text-[var(--color-primary)] underline"
          >
            ← 수업 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <EditCourseForm
      workspaceId={workspaceId}
      courseId={courseId}
      returnHref={returnHref}
      initial={result.data.course}
      options={result.data.options}
    />
  );
}

function normalizeReturnHref(
  workspaceId: string,
  value: string | string[] | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const fallback = `/workspaces/${workspaceId}/manage/courses`;
  if (!raw) return fallback;
  if (!raw.startsWith(`/workspaces/${workspaceId}/`)) return fallback;
  return raw;
}
