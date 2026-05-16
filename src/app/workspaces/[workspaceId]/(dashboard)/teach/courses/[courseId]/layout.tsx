import Link from 'next/link';
import { notFound } from 'next/navigation';

import { InstructorCourseTabs } from '@/components/courses/instructor-course-tabs';
import { getInstructorCourseHome } from '@/services/instructor-course';

type Props = {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string; courseId: string }>;
};

export default async function InstructorCourseLayout({ children, params }: Props) {
  const { workspaceId, courseId } = await params;
  const result = await getInstructorCourseHome(workspaceId, courseId);

  if (!result.ok) notFound();

  const course = result.data.course;
  const accent = course.cardColor ?? '#3B82F6';

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="p-8 pb-0">
          <nav
            aria-label="breadcrumb"
            className="mb-3 flex items-center gap-1.5 text-sm text-gray-500"
          >
            <Link
              href={`/workspaces/${workspaceId}/home`}
              className="transition-colors hover:text-blue-600"
            >
              홈
            </Link>
            <span aria-hidden className="text-gray-300">
              ›
            </span>
            <span className="font-medium text-gray-900">{course.name}</span>
          </nav>

          <div className="flex items-center gap-2.5 pb-5">
            <span
              className="h-3 w-3 flex-shrink-0 rounded-full ring-2 ring-white"
              style={{ backgroundColor: accent }}
              aria-label="수업 색상"
            />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {course.name}
            </h1>
            <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              강사 콘솔
            </span>
          </div>
        </div>

        <div className="px-8">
          <InstructorCourseTabs workspaceId={workspaceId} courseId={courseId} />
        </div>
      </header>

      <div className="flex-1 bg-[#F7F8FE] p-8">{children}</div>
    </div>
  );
}