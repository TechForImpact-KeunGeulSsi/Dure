import { EmptyState } from '@/components/courses/empty-state';
import { requireUser } from '@/lib/auth/require-user';
import { type UUID } from '@/lib/api/types';
import { todayInTimezone } from '@/lib/reports/report-query';
import { getLowAttendanceList } from '@/services/low-attendance';
import { recentMonths } from '@/services/low-attendance-logic';
import { getWorkspaceContext } from '@/services/workspaces';

import { ReportTabs } from '../report-tabs';
import { LowAttendanceClient } from './low-attendance-client';

type Props = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
};

export default async function LowAttendancePage({ params, searchParams }: Props) {
  const { workspaceId } = await params;
  const query = await searchParams;

  await requireUser();
  const context = await getWorkspaceContext(workspaceId);
  if (!context.ok) return <EmptyState message={context.error.message} />;

  const today = todayInTimezone(context.data.workspace.timezone);
  const months = recentMonths(today, 6);
  const requested = Array.isArray(query.month) ? query.month[0] : query.month;
  const month = requested && months.includes(requested) ? requested : months[0];

  const result = await getLowAttendanceList({ workspaceId: workspaceId as UUID, month, today });

  return (
    <div className="space-y-6">
      <ReportTabs workspaceId={workspaceId} active="low-attendance" />
      {result.ok ? (
        <LowAttendanceClient
          workspaceId={workspaceId}
          months={months}
          month={month}
          initialRows={result.data.rows}
        />
      ) : (
        <EmptyState message={result.error.message} />
      )}
    </div>
  );
}
