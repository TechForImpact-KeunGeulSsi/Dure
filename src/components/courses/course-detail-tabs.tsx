'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type CourseDetailTabsProps = {
  workspaceId: string;
  courseId: string;
};

const TAB_ITEMS = [
  { label: '수업 홈', segment: 'home' },
  { label: '수업 자료', segment: 'materials' },
  { label: '참여자 현황', segment: 'participants' },
] as const;

type TabSegment = (typeof TAB_ITEMS)[number]['segment'];

function resolveActiveSegment(pathname: string, basePath: string): TabSegment {
  const matched = TAB_ITEMS.find((tab) => pathname.startsWith(`${basePath}/${tab.segment}`));
  return matched?.segment ?? 'home';
}

export function CourseDetailTabs({ workspaceId, courseId }: CourseDetailTabsProps) {
  const pathname = usePathname();
  const basePath = `/workspaces/${workspaceId}/courses/${courseId}`;
  const activeSegment = resolveActiveSegment(pathname, basePath);

  return (
    <Tabs value={activeSegment} className="w-full border-b border-[var(--color-border)]">
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
                    ? 'border-[var(--color-primary)] font-semibold text-[var(--color-primary)]'
                    : 'border-transparent font-medium text-[var(--color-muted-foreground)] hover:border-[var(--color-border)] hover:text-[var(--color-foreground)]',
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
