import { Users } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { COURSE_STATUS_LABEL, type CourseStatus } from '@/types/course';

type CourseCardProps = {
  workspaceId: string;
  courseId: string;
  name: string;
  subtitle?: string | null;
  status: CourseStatus;
  cardColor: string | null;
  groupNames?: string[];
  participantCount?: number;
  instructorName?: string;
  /**
   * 카드 클릭 시 이동 라우트.
   * - 'manager' (기본): /courses/[id]/home (운영자용)
   * - 'instructor': /teach/courses/[id]/home (강사 콘솔)
   */
  viewType?: 'manager' | 'instructor';
};

export function CourseCard({
  workspaceId,
  courseId,
  name,
  subtitle,
  status,
  cardColor,
  groupNames = [],
  participantCount,
  instructorName,
  viewType = 'manager',
}: CourseCardProps) {
  const href =
    viewType === 'instructor'
      ? `/workspaces/${workspaceId}/teach/courses/${courseId}/home`
      : `/workspaces/${workspaceId}/courses/${courseId}/home`;
  const accent = cardColor ?? '#2563EB';
  const isInProgress = status === 'in_progress';
  const instructorInitial = instructorName?.slice(0, 1) ?? 'M';

  return (
    <Link
      href={href}
      prefetch
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-md"
    >
      <div
        className="relative px-4 pb-6 pt-4"
        style={{ backgroundColor: accent }}
      >
        <h3 className="truncate text-base font-bold text-white">{name}</h3>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-white/80">{subtitle}</p>
        ) : groupNames.length > 0 ? (
          <p className="mt-0.5 truncate text-xs text-white/80">{groupNames.join(', ')}</p>
        ) : null}
        <span className="absolute -bottom-3 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white ring-2 ring-white">
          {instructorInitial}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {instructorName ?? '담당 강사 미배정'}
            </p>
            <p className="text-xs text-gray-400">담당 강사</p>
          </div>
          <span
            className={cn(
              'flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
              isInProgress ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500',
            )}
          >
            {COURSE_STATUS_LABEL[status]}
          </span>
        </div>

        {participantCount !== undefined && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
            <Users className="h-3.5 w-3.5" />
            {participantCount}명 참여자
          </p>
        )}
      </div>
    </Link>
  );
}