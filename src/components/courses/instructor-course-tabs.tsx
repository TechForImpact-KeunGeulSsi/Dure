'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type InstructorCourseTabsProps = {
  workspaceId: string;
  courseId: string;
};

const TAB_ITEMS = [
  { label: '수업 홈', segment: 'home' },
  { label: '수업 자료', segment: 'materials' },
  { label: '출석부', segment: 'attendance' },
  { label: '수업 메모', segment: 'notes' },
  { label: '정산 요청', segment: 'settlements' },
] as const;

type TabSegment = (typeof TAB_ITEMS)[number]['segment'];

function resolveActiveSegment(pathname: string, basePath: string): TabSegment {
  const matched = TAB_ITEMS.find((tab) =>
    pathname.startsWith(`${basePath}/${tab.segment}`),
  );
  return matched?.segment ?? 'home';
}

export function InstructorCourseTabs({ workspaceId, courseId }: InstructorCourseTabsProps) {
  const pathname = usePathname();
  const basePath = `/workspaces/${workspaceId}/teach/courses/${courseId}`;
  const activeSegment = resolveActiveSegment(pathname, basePath);

  return (
    <Tabs value={activeSegment} className="w-full border-b border-gray-200">
      <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-0 bg-transparent p-0">
        {TAB_ITEMS.map((tab) => {
          const isActive = activeSegment === tab.segment;
          return (
            <TabsTrigger
              key={tab.segment}
              value={tab.segment}
              asChild
              className={cn(
                'relative rounded-none border-0 bg-transparent px-0 py-0 shadow-none',
                'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
              )}
            >
              <Link
                href={`${basePath}/${tab.segment}`}
                className={cn(
                  'inline-block border-b-[3px] px-5 py-3 text-sm transition-colors',
                  isActive
                    ? 'border-blue-600 font-semibold text-blue-600'
                    : 'border-transparent font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700',
                )}
              >
                {tab.label}
              </Link>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}