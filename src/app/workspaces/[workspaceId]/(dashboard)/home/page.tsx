import { EmptyState } from '@/components/courses/empty-state';
import { requireUser } from '@/lib/auth/require-user';
import { getWorkspaceContext } from '@/services/workspaces';
import { getAttendanceDashboard } from '@/services/attendance-dashboard';
import { buildMonthlyLowAttendance, recentMonths } from '@/services/low-attendance-logic';
import { getParticipationReport } from '@/services/participation-report';
import { type UUID } from '@/lib/api/types';
import {
  reportPeriod,
  reportPeriodLabel,
  reportQueryToParams,
  type ReportQuery,
} from '@/lib/reports/report-query';

import { DashboardHomeClient } from './home-client';
import { PeriodSummary, type SummaryUnit } from './period-summary';

type Props = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ date?: string | string[]; summary?: string | string[] }>;
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

  const role = context.data.workspace.currentMember.role;
  const today = todayInTimezone(context.data.workspace.timezone);
  const summaryRaw = Array.isArray(query.summary) ? query.summary[0] : query.summary;
  const summaryUnit: SummaryUnit =
    summaryRaw === 'month' || summaryRaw === 'year' ? summaryRaw : 'quarter';
  const reportQuery: ReportQuery = {
    unit: summaryUnit,
    year: Number(today.slice(0, 4)),
    quarter: Math.ceil(Number(today.slice(5, 7)) / 3) as 1 | 2 | 3 | 4,
    month: Number(today.slice(5, 7)),
    courseId: null,
    gender: null,
    disability: null,
    ageBand: null,
  };
  // 저출석은 지난달 기준 (이번 달은 회차가 다 끝나지 않았다)
  const lowAttendanceMonth = recentMonths(today, 2)[1];
  const period = reportPeriod(reportQuery);
  const summaryReport =
    role === 'instructor'
      ? null
      : await getParticipationReport({
          workspaceId: workspaceId as UUID,
          startDate: period.startDate,
          endDate: period.endDate,
          today,
        });
  const todayDashboard =
    role === 'instructor' || selectedDate === today
      ? result
      : await getAttendanceDashboard({ workspaceId: workspaceId as UUID, selectedDate: today });
  const dateParam = Array.isArray(query.date) ? query.date[0] : query.date;

  return (
    <>
      {summaryReport?.ok && todayDashboard.ok ? (
        <PeriodSummary
          workspaceId={workspaceId}
          unit={summaryUnit}
          periodLabel={reportPeriodLabel(reportQuery)}
          reportQuery={reportQueryToParams(reportQuery).toString()}
          dateParam={dateParam ?? null}
          uniqueParticipants={summaryReport.data.total.uniqueParticipants}
          attendanceCount={summaryReport.data.total.attendanceCount}
          missingRecordCount={summaryReport.data.missingRecordCount}
          byCourse={summaryReport.data.byCourse}
          lowAttendanceCount={
            buildMonthlyLowAttendance(todayDashboard.data.courses, lowAttendanceMonth).length
          }
          lowAttendanceMonth={lowAttendanceMonth}
        />
      ) : null}
      <DashboardHomeClient
        workspaceId={workspaceId}
        timezone={context.data.workspace.timezone}
        role={role}
        initialData={result.data}
      />
    </>
  );
}
