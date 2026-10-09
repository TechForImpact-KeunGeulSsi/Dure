'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';
import {
  saveAttendanceContactNote,
  type ContactResult,
  type LowAttendanceListRow,
} from '@/services/low-attendance';
import { MIN_MONTHLY_SESSIONS } from '@/services/low-attendance-logic';

const RESULT_LABELS: Record<ContactResult, string> = {
  reached: '통화함',
  no_answer: '연결 안 됨',
  other: '기타',
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  present: { label: '출', className: 'bg-emerald-600 text-white' },
  partial: { label: '부', className: 'bg-lime-300 text-lime-950' },
  absent: { label: '결', className: 'bg-red-200 text-red-900' },
  missing: { label: '-', className: 'bg-slate-200 text-slate-600' },
};

type Props = {
  workspaceId: string;
  months: string[];
  month: string;
  initialRows: LowAttendanceListRow[];
};

export function LowAttendanceClient({ workspaceId, months, month, initialRows }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
            {Number(month.slice(5))}월 저출석자
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            그 달 출석 기록이 {MIN_MONTHLY_SESSIONS}회 이상이고 출석률이 50% 미만인 참여자입니다. 출석과 부분
            출석을 참여로 세고, 미입력 칸은 빼고 계산합니다.
          </p>
        </div>
        <label className="w-40 space-y-1 text-sm">
          <span className="font-medium text-[var(--color-muted-foreground)]">월</span>
          <Select
            value={month}
            disabled={isPending}
            onChange={(event) =>
              startTransition(() => router.push(`${pathname}?month=${event.target.value}`))
            }
          >
            {months.map((value) => (
              <option key={value} value={value}>
                {value.slice(0, 4)}년 {Number(value.slice(5))}월
              </option>
            ))}
          </Select>
        </label>
      </header>

      <section className={cn('rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)]', isPending && 'opacity-70')}>
        <h2 className="border-b border-[var(--color-border)] px-5 py-3 text-base font-semibold">
          {initialRows.length}명
        </h2>
        {initialRows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
            이 달에는 저출석자가 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="whitespace-nowrap px-5 py-2 font-medium">참여자</th>
                  <th className="px-3 py-2 font-medium">수업</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium">출석/기록</th>
                  <th className="px-3 py-2 font-medium">회차</th>
                  <th className="px-5 py-2 font-medium">연락 결과</th>
                </tr>
              </thead>
              <tbody>
                {initialRows.map((row) => (
                  <LowAttendanceRow
                    key={`${row.courseId}:${row.participantId}`}
                    workspaceId={workspaceId}
                    month={month}
                    row={row}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        문자 발송은 아직 지원하지 않습니다. 연락한 결과는 여기에 직접 남겨 주세요.
      </p>
    </div>
  );
}

function LowAttendanceRow({
  workspaceId,
  month,
  row,
}: {
  workspaceId: string;
  month: string;
  row: LowAttendanceListRow;
}) {
  const [result, setResult] = useState<ContactResult | ''>(row.contact?.result ?? '');
  const [note, setNote] = useState(row.contact?.note ?? '');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(
    row.contact ? { tone: 'ok', text: '저장됨' } : null,
  );
  const [isSaving, startSaving] = useTransition();

  function save() {
    if (!result) {
      setMessage({ tone: 'error', text: '연락 결과를 골라 주세요.' });
      return;
    }
    startSaving(async () => {
      const response = await saveAttendanceContactNote({
        workspaceId,
        courseId: row.courseId,
        participantId: row.participantId,
        month,
        result,
        note,
      });
      setMessage(
        response.ok ? { tone: 'ok', text: '저장됨' } : { tone: 'error', text: response.error.message },
      );
    });
  }

  return (
    <tr className="border-t border-[var(--color-border)] align-top">
      <td className="whitespace-nowrap px-5 py-3 font-medium">{row.participantName}</td>
      <td className="whitespace-nowrap px-3 py-3">{row.courseName}</td>
      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
        {row.attendedCount}/{row.validCount}
        <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">{row.rate}%</span>
        {row.missingCount > 0 ? (
          <span className="block text-xs text-amber-700">미입력 {row.missingCount}</span>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <ul className="flex gap-1" aria-label="회차별 출석">
          {row.sessions.map((session) => {
            const config = STATUS_LABELS[session.status] ?? STATUS_LABELS.missing;
            return (
              <li
                key={session.sessionId}
                title={`${session.date} ${session.sessionNo}회차`}
                className={cn('flex h-6 w-6 items-center justify-center rounded text-xs font-semibold', config.className)}
              >
                {config.label}
              </li>
            );
          })}
        </ul>
      </td>
      <td className="min-w-[320px] px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={`${row.participantName} 연락 결과`}
            className="w-32"
            value={result}
            onChange={(event) => {
              setResult(event.target.value as ContactResult | '');
              setMessage(null);
            }}
          >
            <option value="">선택</option>
            {(Object.keys(RESULT_LABELS) as ContactResult[]).map((key) => (
              <option key={key} value={key}>
                {RESULT_LABELS[key]}
              </option>
            ))}
          </Select>
          <input
            aria-label={`${row.participantName} 연락 메모`}
            value={note}
            maxLength={500}
            placeholder="메모"
            onChange={(event) => {
              setNote(event.target.value);
              setMessage(null);
            }}
            className="h-9 min-w-40 flex-1 rounded-[var(--radius-md)] border border-[var(--color-input)] bg-white px-3 text-sm outline-none focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]/20"
          />
          <Button size="sm" onClick={save} disabled={isSaving}>
            {isSaving ? '저장 중' : '저장'}
          </Button>
        </div>
        {message ? (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={cn('mt-1 text-xs', message.tone === 'error' ? 'text-red-700' : 'text-[var(--color-muted-foreground)]')}
          >
            {message.text}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
