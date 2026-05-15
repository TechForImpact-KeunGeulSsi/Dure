'use client';

import { Plus } from 'lucide-react';
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
};

export function DashboardHomeClient({ workspaceId, courses }: DashboardHomeClientProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredCourses = useMemo(() => {
    if (statusFilter === 'all') return courses;
    return courses.filter((course) => course.status === statusFilter);
  }, [courses, statusFilter]);

  return (
    <div className="p-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">운영 중인 수업</h1>
          <p className="mt-1 text-sm text-gray-500">
            수업과 참여자 진행 현황을 관리합니다.
          </p>
        </div>
        <Button type="button" className="flex-shrink-0 gap-2 self-start">
          <Plus className="h-4 w-4" />
          수업 만들기
        </Button>
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
          <p className="text-sm text-gray-500">해당 상태의 수업이 없습니다.</p>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
