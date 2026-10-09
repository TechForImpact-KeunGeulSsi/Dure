import { EmptyState } from '@/components/courses/empty-state';
import { requireUser } from '@/lib/auth/require-user';
import { getWorkspaceContext } from '@/services/workspaces';
import { getAttendanceDashboard } from '@/services/attendance-dashboard';
import { buildMonthlyLowAttendance, recentMonths } from '@/services/low-attendance-logic';
import { getParticipationReport } from '@/services/participation-report';
import { quarterPeriod } from '@/services/participation-report-logic';
import { type UUID } from '@/lib/api/types';

import { DashboardHomeClient } from './home-client';
import { QuarterSummary } from './quarter-summary';

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

  const role = context.data.workspace.currentMember.role;
  const today = todayInTimezone(context.data.workspace.timezone);
  const year = Number(today.slice(0, 4));
  const quarter = Math.ceil(Number(today.slice(5, 7)) / 3) as 1 | 2 | 3 | 4;
  // 저출석은 지난달 기준 (이번 달은 회차가 다 끝나지 않았다)
  const lowAttendanceMonth = recentMonths(today, 2)[1];
  const period = quarterPeriod(year, quarter);
  const quarterReport =
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

  return (
    <>
      {quarterReport?.ok && todayDashboard.ok ? (
        <QuarterSummary
          workspaceId={workspaceId}
          year={year}
          quarter={quarter}
          uniqueParticipants={quarterReport.data.total.uniqueParticipants}
          attendanceCount={quarterReport.data.total.attendanceCount}
          missingRecordCount={quarterReport.data.missingRecordCount}
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
