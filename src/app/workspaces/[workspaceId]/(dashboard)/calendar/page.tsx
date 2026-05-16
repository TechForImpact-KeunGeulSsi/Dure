import { format } from 'date-fns';
import { redirect } from 'next/navigation';

import { EmptyState } from '@/components/ui/empty-state';
import { getCalendarMonth } from '@/services/calendar';
import { getGroupsPage } from '@/services/groups';
import { getWorkspaceContext } from '@/services/workspaces';

import { CalendarClient } from './calendar-client';

type CalendarPageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ month?: string }>;
};

export default async function CalendarPage({ params, searchParams }: CalendarPageProps) {
  const { workspaceId } = await params;
  const { month: monthParam } = await searchParams;
  const month = monthParam ?? format(new Date(), 'yyyy-MM');

  const [calendarResult, groupsResult, contextResult] = await Promise.all([
    getCalendarMonth({ workspaceId, month }),
    getGroupsPage({ workspaceId, status: 'active', pageSize: 100 }),
    getWorkspaceContext(workspaceId),
  ]);

  // 강사는 일정 관리 화면에 접근할 수 없음. sidebar에서 숨겨두지만 URL 직접
  // 입력 차단을 위해 한 번 더 가드.
  if (contextResult.ok) {
    const role = contextResult.data.workspace.currentMember.role;
    if (role === 'instructor') {
      redirect(`/workspaces/${workspaceId}/home`);
    }
  }

  if (!calendarResult.ok) {
    return (
      <EmptyState
        title="일정을 불러오지 못했습니다"
        description={calendarResult.error.message}
      />
    );
  }

  const groupOptions = groupsResult.ok
    ? groupsResult.data.groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        status: g.status,
      }))
    : [];

  return (
    <CalendarClient
      workspaceId={workspaceId}
      month={month}
      initialData={calendarResult.data}
      groupOptions={groupOptions}
    />
  );
}
