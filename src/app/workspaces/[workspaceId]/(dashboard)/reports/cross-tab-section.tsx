'use client';

import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils/cn';
import {
  buildCrossTab,
  type CrossTabDimension,
  type ParticipationEvidence,
  type ParticipationReport,
} from '@/services/participation-report-logic';

const DIMENSIONS: Array<{ key: CrossTabDimension; label: string }> = [
  { key: 'gender', label: '성별' },
  { key: 'disability', label: '장애 유무' },
  { key: 'ageBand', label: '연령대' },
];

const EVIDENCE_KEY: Record<CrossTabDimension, (row: ParticipationEvidence) => string> = {
  gender: (row) => row.gender ?? 'unknown',
  disability: (row) => row.disability,
  ageBand: (row) => row.ageBand,
};

export function CrossTabSection({
  report,
  onSelect,
}: {
  report: Pick<ParticipationReport, 'evidence' | 'byCourse'>;
  onSelect: (selection: { label: string; match: (row: ParticipationEvidence) => boolean }) => void;
}) {
  const [dimension, setDimension] = useState<CrossTabDimension>('gender');
  const table = useMemo(() => buildCrossTab(report, dimension), [report, dimension]);
  const keyOf = EVIDENCE_KEY[dimension];

  const cell = (
    count: { uniqueParticipants: number; attendanceCount: number },
    label: string,
    match: (row: ParticipationEvidence) => boolean,
  ) => (
    <button
      type="button"
      onClick={() => onSelect({ label, match })}
      className="rounded px-1 tabular-nums hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      {count.uniqueParticipants}명
      <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">{count.attendanceCount}회</span>
    </button>
  );

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-5 py-3">
        <h2 className="text-base font-semibold">{table.title}</h2>
        <div role="group" aria-label="교차표 구분" className="flex gap-1">
          {DIMENSIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={dimension === item.key}
              onClick={() => setDimension(item.key)}
              className={cn(
                'rounded-[var(--radius-md)] px-3 py-1 text-sm font-medium',
                dimension === item.key
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--color-muted-foreground)]">
            <tr>
              <th className="whitespace-nowrap px-5 py-2 font-medium">수업</th>
              {table.columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {column.label}
                </th>
              ))}
              <th className="whitespace-nowrap px-5 py-2 text-right font-medium">합계</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.courseId} className="border-t border-[var(--color-border)]">
                <td className="whitespace-nowrap px-5 py-2">{row.courseName}</td>
                {table.columns.map((column) => (
                  <td key={column.key} className="px-3 py-2 text-right">
                    {cell(
                      row.cells[column.key],
                      `${row.courseName} · ${column.label}`,
                      (evidence) => evidence.courseId === row.courseId && keyOf(evidence) === column.key,
                    )}
                  </td>
                ))}
                <td className="px-5 py-2 text-right font-medium">
                  {cell(row.total, row.courseName, (evidence) => evidence.courseId === row.courseId)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--color-border)] font-semibold">
              <td className="whitespace-nowrap px-5 py-2">합계(중복 제외)</td>
              {table.columns.map((column) => (
                <td key={column.key} className="px-3 py-2 text-right">
                  {cell(table.totalRow.cells[column.key], `전체 · ${column.label}`, (evidence) => keyOf(evidence) === column.key)}
                </td>
              ))}
              <td className="px-5 py-2 text-right">{cell(table.totalRow.total, '전체', () => true)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="border-t border-[var(--color-border)] px-5 py-2 text-xs text-[var(--color-muted-foreground)]">
        칸마다 실인원(명)과 연인원(회)입니다. 합계 줄은 수업별 숫자를 더하지 않고 다시 세어 중복을 뺍니다.
      </p>
    </section>
  );
}
