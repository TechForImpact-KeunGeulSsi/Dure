import Link from "next/link";
import { Plus } from "lucide-react";

import { CourseCard } from "@/components/courses/course-card";
import { getCoursesPage } from "@/services/courses";
import type { CourseListItem } from "@/lib/api/types";

type DashboardHomeProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function DashboardHomePage({ params }: DashboardHomeProps) {
  const { workspaceId } = await params;
  const result = await getCoursesPage({ workspaceId, pageSize: 100 });

  const courses: CourseListItem[] = result.ok
    ? prioritizeActive(result.data.courses)
    : [];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
          운영 중인 수업
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          수업과 참여자 진행 현황을 관리합니다.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {courses.map((course) => (
          <li key={course.id}>
            <CourseCard course={course} />
          </li>
        ))}
        <li>
          <AddCourseCard workspaceId={workspaceId} />
        </li>
      </ul>
    </div>
  );
}

function prioritizeActive(courses: CourseListItem[]): CourseListItem[] {
  const order: Record<CourseListItem["status"], number> = {
    in_progress: 0,
    planned: 1,
    completed: 2,
  };
  return [...courses].sort(
    (a, b) => order[a.status] - order[b.status],
  );
}

function AddCourseCard({ workspaceId }: { workspaceId: string }) {
  return (
    <Link
      href={`/workspaces/${workspaceId}/manage/courses/new`}
      className="group flex h-full min-h-[18rem] flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-card)] px-6 py-8 text-center transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition-colors group-hover:bg-[var(--color-primary)] group-hover:text-white">
        <Plus className="size-5" />
      </span>
      <p className="mt-4 text-base font-semibold text-[var(--color-foreground)]">
        수업 추가
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        새로운 수업 또는
        <br />
        교육 과정을 개설합니다.
      </p>
    </Link>
  );
}
