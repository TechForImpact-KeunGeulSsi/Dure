import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { getCourseFormOptions } from "@/services/courses";
import { getWorkspaceContext } from "@/services/workspaces";

import { NewCourseForm } from "./new-course-form";

type NewCoursePageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function NewCoursePage({ params }: NewCoursePageProps) {
  const { workspaceId } = await params;
  const [contextResult, optionsResult] = await Promise.all([
    getWorkspaceContext(workspaceId),
    getCourseFormOptions({ workspaceId, groupIds: [] }),
  ]);

  if (!contextResult.ok) {
    if (contextResult.error.code === "WORKSPACE_ACCESS_DENIED") {
      redirect("/workspaces");
    }
    return (
      <EmptyState
        title="수업 생성 화면을 불러오지 못했습니다"
        description={contextResult.error.message}
      />
    );
  }

  const role = contextResult.data.workspace.currentMember.role;
  if (role === "instructor") {
    redirect(`/workspaces/${workspaceId}/home`);
  }

  if (!optionsResult.ok) {
    return (
      <EmptyState
        title="수업 생성 화면을 불러오지 못했습니다"
        description={optionsResult.error.message}
      />
    );
  }

  return (
    <NewCourseForm
      workspaceId={workspaceId}
      initialOptions={optionsResult.data}
      accessibleGroups={contextResult.data.accessibleGroups}
    />
  );
}
