'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { CourseCard } from '@/components/courses/course-card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CourseStatus, DashboardCourseItem } from '@/types/course';
import { COURSE_STATUS_LABEL } from '@/types/course';

type StatusFilter = 'all' | CourseStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'planned', label: COURSE_STATUS_LABEL.planned },
  { value: 'in_progress', label: COURSE_STATUS_LABEL.in_progress },
  { value: 'completed', label: COURSE_STATUS_LABEL.completed },
];

type DashboardHomeClientProps = {
  workspaceId: string;
  courses: DashboardCourseItem[];
  /** 'manager' 운영자 카드 → /courses/[id]/home, 'instructor' 강사 카드 → /teach/courses/[id]/home */
  viewType: 'manager' | 'instructor';
  canCreateCourse: boolean;
};

export function DashboardHomeClient({
  workspaceId,
  courses,
  viewType,
  canCreateCourse,
}: DashboardHomeClientProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredCourses = useMemo(() => {
    if (statusFilter === 'all') return courses;
    return courses.filter((course) => course.status === statusFilter);
  }, [courses, statusFilter]);

  const headerTitle = viewType === 'instructor' ? '담당 수업' : '운영 중인 수업';
  const headerSubtitle =
    viewType === 'instructor'
      ? '담당하는 수업에 진입해 자료, 출석부, 메모를 관리합니다.'
      : '수업과 참여자 진행 현황을 관리합니다.';

  return (
    <div className="p-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{headerTitle}</h1>
          <p className="mt-1 text-sm text-gray-500">{headerSubtitle}</p>
        </div>
        {canCreateCourse && (
          <Button
            type="button"
            className="flex-shrink-0 gap-2 self-start"
            onClick={() => router.push(`/workspaces/${workspaceId}/manage/courses/new`)}
          >
            <Plus className="h-4 w-4" />
            수업 만들기
          </Button>
        )}
      </header>

      <Tabs
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        className="mb-6"
      >
        <TabsList>
          {STATUS_FILTERS.map((filter) => (
            <TabsTrigger key={filter.value} value={filter.value}>
              {filter.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filteredCourses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-sm text-gray-500">
            {viewType === 'instructor'
              ? '담당하는 수업이 없습니다.'
              : '해당 상태의 수업이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCourses.map((course) => (
            <CourseCard
              key={course.id}
              workspaceId={workspaceId}
              courseId={course.id}
              name={course.name}
              subtitle={course.groups[0]?.description ?? course.groups[0]?.name}
              status={course.status}
              cardColor={course.cardColor}
              groupNames={course.groups.map((g) => g.name)}
              participantCount={course.participantCount}
              instructorName={course.instructor?.displayName ?? undefined}
              viewType={viewType}
            />
          ))}
          {canCreateCourse && <AddCourseCard workspaceId={workspaceId} />}
        </div>
      )}
    </div>
  );
}

function AddCourseCard({ workspaceId }: { workspaceId: string }) {
  return (
    <Link
      href={`/workspaces/${workspaceId}/manage/courses/new`}
      className="group flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
        <Plus className="h-6 w-6" />
      </span>
      <div>
        <p className="text-base font-bold text-gray-900">수업 추가</p>
        <p className="mt-1 text-xs text-gray-500">
          새로운 수업 또는<br />교육 과정을 개설합니다.
        </p>
      </div>
    </Link>
  );
}
