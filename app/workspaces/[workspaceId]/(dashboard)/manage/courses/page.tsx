import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { getCoursesPage } from "@/services/courses";
import { getWorkspaceContext } from "@/services/workspaces";
import type { CourseStatus } from "@/lib/api/types";

import { CoursesClient } from "./courses-client";

type CoursesPageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{
    search?: string;
    groupId?: string;
    status?: string;
    page?: string;
  }>;
};

const VALID_STATUSES: CourseStatus[] = ["planned", "in_progress", "completed"];

export default async function CoursesPage({
  params,
  searchParams,
}: CoursesPageProps) {
  const { workspaceId } = await params;
  const sp = await searchParams;

  const status =
    sp.status && (VALID_STATUSES as string[]).includes(sp.status)
      ? (sp.status as CourseStatus)
      : undefined;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [contextResult, coursesResult] = await Promise.all([
    getWorkspaceContext(workspaceId),
    getCoursesPage({
      workspaceId,
      search: sp.search,
      groupId: sp.groupId,
      status,
      page,
    }),
  ]);

  if (!contextResult.ok || !coursesResult.ok) {
    const err = !contextResult.ok
      ? contextResult.error
      : coursesResult.ok
        ? null
        : coursesResult.error;
    if (err?.code === "WORKSPACE_ACCESS_DENIED") {
      redirect("/workspaces");
    }
    return (
      <EmptyState
        title="수업 목록을 불러오지 못했습니다"
        description={err?.message ?? "잠시 후 다시 시도해 주세요."}
      />
    );
  }

  const role = contextResult.data.workspace.currentMember.role;
  const canCreate = role === "owner_admin" || role === "group_admin";

  return (
    <CoursesClient
      workspaceId={workspaceId}
      initialFilters={{
        search: sp.search ?? "",
        groupId: sp.groupId ?? "",
        status: sp.status ?? "",
      }}
      data={coursesResult.data}
      accessibleGroups={contextResult.data.accessibleGroups}
      canCreate={canCreate}
    />
  );
}
