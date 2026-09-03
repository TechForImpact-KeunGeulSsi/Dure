import { EmptyState } from '@/components/courses/empty-state';
import { requireUser } from '@/lib/auth/require-user';
import { getWorkspaceContext } from '@/services/workspaces';
import { getAttendanceDashboard } from '@/services/attendance-dashboard';
import { type UUID } from '@/lib/api/types';

import { DashboardHomeClient } from './home-client';

type Props = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ date?: string | string[] }>;
};

function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function selectedDateOrToday(value: string | string[] | undefined, timezone: string): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate)
    ? candidate
    : todayInTimezone(timezone);
}

export default async function DashboardHomePage({ params, searchParams }: Props) {
  const { workspaceId } = await params;
  const query = await searchParams;

  await requireUser();
  const context = await getWorkspaceContext(workspaceId);
  if (!context.ok) {
    return <EmptyState message={context.error.message} />;
  }

  const selectedDate = selectedDateOrToday(
    query.date,
    context.data.workspace.timezone,
  );
  const result = await getAttendanceDashboard({
    workspaceId: workspaceId as UUID,
    selectedDate,
  });
  if (!result.ok) return <EmptyState message={result.error.message} />;

  return (
    <DashboardHomeClient
      workspaceId={workspaceId}
      timezone={context.data.workspace.timezone}
      role={context.data.workspace.currentMember.role}
      initialData={result.data}
    />
  );
}
