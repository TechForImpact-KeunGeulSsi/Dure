import { EmptyState } from '@/components/courses/empty-state';
import { requireUser } from '@/lib/auth/require-user';
import { type UUID } from '@/lib/api/types';
import { getParticipationReport } from '@/services/participation-report';
import {
  monthPeriod,
  quarterPeriod,
  yearPeriod,
  type ParticipationReportPeriod,
} from '@/services/participation-report-logic';
import { getWorkspaceContext } from '@/services/workspaces';

import { ReportClient, type ReportQuery } from './report-client';

type Props = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function intInRange(value: string | undefined, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function parseReportQuery(
  raw: Record<string, string | string[] | undefined>,
  today: string,
): ReportQuery {
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const unitRaw = first(raw.unit);
  const unit = unitRaw === 'month' || unitRaw === 'year' ? unitRaw : 'quarter';
  const gender = first(raw.gender);
  const disability = first(raw.disability);
  const age = first(raw.age);
  const course = first(raw.course);
  return {
    unit,
    year: intInRange(first(raw.year), 2000, 2100, thisYear),
    quarter: intInRange(first(raw.quarter), 1, 4, Math.ceil(thisMonth / 3)) as 1 | 2 | 3 | 4,
    month: intInRange(first(raw.month), 1, 12, thisMonth),
    courseId: course && /^[0-9a-f-]{36}$/i.test(course) ? course : null,
    gender: gender === 'female' || gender === 'male' ? gender : null,
    disability: disability === 'yes' || disability === 'no' ? disability : null,
    ageBand: age && /^\d{1,3}$/.test(age) ? age : null,
  };
}

function periodOf(query: ReportQuery): ParticipationReportPeriod {
  if (query.unit === 'month') return monthPeriod(query.year, query.month);
  if (query.unit === 'year') return yearPeriod(query.year);
  return quarterPeriod(query.year, query.quarter);
}

export default async function ReportsPage({ params, searchParams }: Props) {
  const { workspaceId } = await params;
  const raw = await searchParams;

  await requireUser();
  const context = await getWorkspaceContext(workspaceId);
  if (!context.ok) return <EmptyState message={context.error.message} />;

  const today = todayInTimezone(context.data.workspace.timezone);
  const query = parseReportQuery(raw, today);
  const period = periodOf(query);
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

  return (
    <ReportClient
      workspaceId={workspaceId}
      thisYear={Number(today.slice(0, 4))}
      query={query}
      report={result.data}
    />
  );
}
