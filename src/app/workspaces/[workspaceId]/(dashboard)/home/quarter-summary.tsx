import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

type QuarterSummaryProps = {
  workspaceId: string;
  year: number;
  quarter: number;
  uniqueParticipants: number;
  attendanceCount: number;
  missingRecordCount: number;
  lowAttendanceCount: number;
  lowAttendanceMonth: string;
};

export function QuarterSummary({
  workspaceId,
  year,
  quarter,
  uniqueParticipants,
  attendanceCount,
  missingRecordCount,
  lowAttendanceCount,
  lowAttendanceMonth,
}: QuarterSummaryProps) {
  const base = `/workspaces/${workspaceId}/reports`;
  return (
    <section
      aria-label="이번 분기 참여 실적"
      className="mb-6 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {year}년 {quarter}분기 실인원
        </p>
        <p className="text-2xl font-semibold tabular-nums">
          {uniqueParticipants.toLocaleString('ko-KR')}
          <span className="ml-1 text-sm font-medium">명</span>
        </p>
      </div>
      <div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {year}년 {quarter}분기 연인원
        </p>
        <p className="text-2xl font-semibold tabular-nums">
          {attendanceCount.toLocaleString('ko-KR')}
          <span className="ml-1 text-sm font-medium">회</span>
        </p>
      </div>
      <Link
        href={`${base}/low-attendance?month=${lowAttendanceMonth}`}
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
          분기 출석 미입력 <span className="font-semibold text-[var(--color-foreground)]">{missingRecordCount}건</span>
        </p>
        <Link
          href={`${base}?unit=quarter&year=${year}&quarter=${quarter}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          분기 보고서 보기
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
