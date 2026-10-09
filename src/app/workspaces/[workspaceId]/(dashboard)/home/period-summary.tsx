import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

export type SummaryUnit = 'month' | 'quarter' | 'year';

type PeriodSummaryProps = {
  workspaceId: string;
  unit: SummaryUnit;
  periodLabel: string;
  reportQuery: string;
  dateParam: string | null;
  uniqueParticipants: number;
  attendanceCount: number;
  missingRecordCount: number;
  byCourse: Array<{ courseId: string; courseName: string; uniqueParticipants: number; attendanceCount: number }>;
  lowAttendanceCount: number;
  lowAttendanceMonth: string;
};

const UNITS: Array<{ key: SummaryUnit; label: string }> = [
  { key: 'month', label: '이번 달' },
  { key: 'quarter', label: '이번 분기' },
  { key: 'year', label: '올해' },
];

export function PeriodSummary({
  workspaceId,
  unit,
  periodLabel,
  reportQuery,
  dateParam,
  uniqueParticipants,
  attendanceCount,
  missingRecordCount,
  byCourse,
  lowAttendanceCount,
  lowAttendanceMonth,
}: PeriodSummaryProps) {
  const base = `/workspaces/${workspaceId}`;
  const maxCount = Math.max(1, ...byCourse.map((row) => row.attendanceCount));
  return (
    <section
      aria-label={`${periodLabel} 참여 실적`}
      className="mb-6 space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{periodLabel} 참여 실적</h2>
        <nav aria-label="실적 기간" className="flex gap-1">
          {UNITS.map((item) => {
            const params = new URLSearchParams();
            if (dateParam) params.set('date', dateParam);
            params.set('summary', item.key);
            return (
              <Link
                key={item.key}
                href={`${base}/home?${params.toString()}`}
                aria-current={unit === item.key ? 'page' : undefined}
                className={cn(
                  'rounded-[var(--radius-md)] px-3 py-1 text-sm font-medium',
                  unit === item.key
                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                    : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-sm text-[var(--color-muted-foreground)]">실인원</p>
          <p className="text-2xl font-semibold tabular-nums">
            {uniqueParticipants.toLocaleString('ko-KR')}
            <span className="ml-1 text-sm font-medium">명</span>
          </p>
        </div>
        <div>
          <p className="text-sm text-[var(--color-muted-foreground)]">연인원</p>
          <p className="text-2xl font-semibold tabular-nums">
            {attendanceCount.toLocaleString('ko-KR')}
            <span className="ml-1 text-sm font-medium">회</span>
          </p>
        </div>
        <Link
          href={`${base}/reports/low-attendance?month=${lowAttendanceMonth}`}
          className="rounded-[var(--radius-md)] px-2 py-1 hover:bg-[var(--color-muted)]"
        >
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {Number(lowAttendanceMonth.slice(5))}월 저출석자
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {lowAttendanceCount}
            <span className="ml-1 text-sm font-medium">명</span>
          </p>
        </Link>
        <div className="flex flex-col justify-between gap-2">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            출석 미입력{' '}
            <span className="font-semibold text-[var(--color-foreground)]">{missingRecordCount}건</span>
          </p>
          <Link
            href={`${base}/reports?${reportQuery}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            보고서 보기
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {byCourse.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">수업별 연인원</h3>
          <ul className="space-y-1.5">
            {byCourse.map((row) => (
              <li key={row.courseId} className="grid grid-cols-[7rem_minmax(0,1fr)_6.5rem] items-center gap-3 text-sm">
                <span className="truncate">{row.courseName}</span>
                <span className="h-2 rounded-full bg-[var(--color-muted)]">
                  <span
                    className="block h-2 rounded-full bg-[var(--color-primary)]"
                    style={{ width: `${(row.attendanceCount / maxCount) * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums text-[var(--color-muted-foreground)]">
                  {row.attendanceCount}회 · {row.uniqueParticipants}명
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
