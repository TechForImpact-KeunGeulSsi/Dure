import { EmptyState } from '@/components/courses/empty-state';
import { requireUser } from '@/lib/auth/require-user';
import { type UUID } from '@/lib/api/types';
import { parseReportQuery, reportPeriod, todayInTimezone } from '@/lib/reports/report-query';
import { getParticipationReport } from '@/services/participation-report';
import { listReportExports } from '@/services/report-exports';
import { getWorkspaceContext } from '@/services/workspaces';

import { ReportClient } from './report-client';
import { ReportTabs } from './report-tabs';

type Props = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ params, searchParams }: Props) {
  const { workspaceId } = await params;
  const raw = await searchParams;

  await requireUser();
  const context = await getWorkspaceContext(workspaceId);
  if (!context.ok) return <EmptyState message={context.error.message} />;

  const today = todayInTimezone(context.data.workspace.timezone);
  const query = parseReportQuery(raw, today);
  const period = reportPeriod(query);
  const result = await getParticipationReport({
    workspaceId: workspaceId as UUID,
    startDate: period.startDate,
    endDate: period.endDate,
    today,
    courseIds: query.courseId ? [query.courseId] : undefined,
    gender: query.gender ?? undefined,
    hasDisability: query.disability ? query.disability === 'yes' : undefined,
    ageBand: query.ageBand ?? undefined,
  });
  if (!result.ok) return <EmptyState message={result.error.message} />;
  const exports = await listReportExports(workspaceId);

  return (
    <div className="space-y-6">
      <ReportTabs workspaceId={workspaceId} active="participation" />
      <ReportClient
        workspaceId={workspaceId}
        thisYear={Number(today.slice(0, 4))}
        query={query}
        report={result.data}
        exports={exports.ok ? exports.data : []}
      />
    </div>
  );
}
