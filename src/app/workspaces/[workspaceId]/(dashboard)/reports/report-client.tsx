'use client';

import { AlertTriangle, FileDown, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  reportPeriodLabel,
  reportQueryToParams,
  type ReportQuery,
} from '@/lib/reports/report-query';
import { cn } from '@/lib/utils/cn';
import type { ParticipationReportOutput } from '@/services/participation-report';
import {
  ageBandLabel,
  type ParticipationBreakdownRow,
  type ParticipationEvidence,
} from '@/services/participation-report-logic';
import { buildParticipantRows, type SubmissionOptions } from '@/services/report-export-logic';
import { recordReportExport, type ReportExportItem } from '@/services/report-exports';

import { CrossTabSection } from './cross-tab-section';
import { SubmissionDialog } from './submission-dialog';
import { SubmissionPrint } from './submission-print';


type Selection = {
  label: string;
  match: (row: ParticipationEvidence) => boolean;
};

const AGE_BANDS = ['0', '10', '20', '30', '40', '50', '60', '70', '80'];

type ReportClientProps = {
  workspaceId: string;
  thisYear: number;
  query: ReportQuery;
  report: ParticipationReportOutput;
  exports: ReportExportItem[];
};

export function ReportClient({ workspaceId, thisYear, query, report, exports }: ReportClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printJob, setPrintJob] = useState<{ options: SubmissionOptions; generatedAt: string } | null>(
    null,
  );

  useEffect(() => {
    if (!printJob) return;
    const timer = window.setTimeout(() => window.print(), 100);
    return () => window.clearTimeout(timer);
  }, [printJob]);
  const evidenceRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // 좁은 화면에서는 근거 기록이 표 아래에 붙으므로 그 위치로 이동한다.
    if (selection && window.matchMedia('(max-width: 1023px)').matches) {
      evidenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selection]);

  const courseNameById = useMemo(
    () => new Map(report.courseOptions.map((course) => [course.id, course.name])),
    [report.courseOptions],
  );
  const participantById = useMemo(
    () => new Map(report.participants.map((participant) => [participant.id, participant])),
    [report.participants],
  );

  function update(patch: Partial<ReportQuery>) {
    const params = reportQueryToParams({ ...query, ...patch });
    setSelection(null);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const periodLabel = reportPeriodLabel(query);
  const maxCourseCount = Math.max(1, ...report.byCourse.map((row) => row.attendanceCount));
  const selectedRows = selection ? report.evidence.filter(selection.match) : [];

  return (
    <>
      <div className="space-y-6 print:hidden" data-workspace-id={workspaceId}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--color-primary)]">보고서</p>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
            {periodLabel} 참여 실적
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {report.period.startDate} ~ {report.period.endDate} · 출석과 부분 출석을 참여로 셉니다.
            휴강 회차는 제외합니다.
          </p>
        </div>
        <Button className="print:hidden" onClick={() => setSubmissionOpen(true)}>
          <FileDown className="mr-1.5 h-4 w-4" aria-hidden="true" />
          제출 파일 만들기
        </Button>
      </header>

      <SubmissionDialog
        open={submissionOpen}
        onOpenChange={setSubmissionOpen}
        workspaceId={workspaceId}
        query={query}
        periodLabel={periodLabel}
        report={report}
        exports={exports}
        onDownloaded={() => window.setTimeout(() => router.refresh(), 1500)}
        onPrint={async (options) => {
          // 인쇄도 제출 파일이므로 먼저 이력을 남긴다. 기록에 실패하면 인쇄하지 않는다.
          const recorded = await recordReportExport({
            workspaceId,
            format: 'print',
            periodLabel,
            startDate: report.period.startDate,
            endDate: report.period.endDate,
            filters: {
              courseId: query.courseId,
              gender: query.gender,
              disability: query.disability,
              ageBand: query.ageBand,
            },
            options,
            participantRowCount: Math.max(
              0,
              buildParticipantRows({
                report,
                courseNames: new Map(),
                participantNames: new Map(),
                periodLabel,
                missingRecordCount: report.missingRecordCount,
                generatedAt: '',
                options,
              }).length - 1,
            ),
          });
          if (!recorded.ok) {
            setPrintError(recorded.error.message);
            return;
          }
          setPrintError(null);
          setPrintJob({
            options,
            generatedAt: new Intl.DateTimeFormat('ko-KR', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date()),
          });
          router.refresh();
        }}
      />

      <section
        aria-label="조회 조건"
        className={cn(
          'grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden',
          isPending && 'opacity-70',
        )}
      >
        <Field label="기간 단위">
          <Select
            value={query.unit}
            onChange={(event) => update({ unit: event.target.value as ReportQuery['unit'] })}
          >
            <option value="month">월</option>
            <option value="quarter">분기</option>
            <option value="year">연도</option>
          </Select>
        </Field>
        <Field label="연도">
          <Select value={query.year} onChange={(event) => update({ year: Number(event.target.value) })}>
            {[thisYear - 2, thisYear - 1, thisYear].map((year) => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </Select>
        </Field>
        {query.unit === 'quarter' ? (
          <Field label="분기">
            <Select
              value={query.quarter}
              onChange={(event) =>
                update({ quarter: Number(event.target.value) as ReportQuery['quarter'] })
              }
            >
              {[1, 2, 3, 4].map((quarter) => (
                <option key={quarter} value={quarter}>
                  {quarter}분기
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {query.unit === 'month' ? (
          <Field label="월">
            <Select value={query.month} onChange={(event) => update({ month: Number(event.target.value) })}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>
                  {month}월
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="수업">
          <Select
            value={query.courseId ?? ''}
            onChange={(event) => update({ courseId: event.target.value || null })}
          >
            <option value="">전체 수업</option>
            {report.courseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="성별">
          <Select
            value={query.gender ?? ''}
            onChange={(event) =>
              update({ gender: (event.target.value || null) as ReportQuery['gender'] })
            }
          >
            <option value="">전체</option>
            <option value="female">여성</option>
            <option value="male">남성</option>
          </Select>
        </Field>
        <Field label="장애 유무">
          <Select
            value={query.disability ?? ''}
            onChange={(event) =>
              update({ disability: (event.target.value || null) as ReportQuery['disability'] })
            }
          >
            <option value="">전체</option>
            <option value="yes">장애인</option>
            <option value="no">비장애인</option>
          </Select>
        </Field>
        <Field label="연령대">
          <Select
            value={query.ageBand ?? ''}
            onChange={(event) => update({ ageBand: event.target.value || null })}
          >
            <option value="">전체</option>
            {AGE_BANDS.map((band) => (
              <option key={band} value={band}>
                {ageBandLabel(band)}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      {printError ? (
        <p role="alert" className="rounded-[var(--radius-md)] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          인쇄하지 못했습니다. {printError}
        </p>
      ) : null}

      {report.missingRecordCount > 0 ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            이 기간에 출석이 입력되지 않은 칸이 {report.missingRecordCount}건 있습니다. 입력하면
            숫자가 바뀔 수 있습니다.
          </span>
        </div>
      ) : null}

      <div className={cn('grid gap-6', selection && 'lg:grid-cols-[minmax(0,1fr)_380px]')}>
        <div className="space-y-6">
          <section aria-label="합계" className="grid gap-4 sm:grid-cols-2">
            <SummaryCard
              title="실인원"
              unit="명"
              value={report.total.uniqueParticipants}
              hint="기간 안에 한 번이라도 참여한 사람 수"
              onSelect={() => setSelection({ label: `전체 · ${periodLabel}`, match: () => true })}
            />
            <SummaryCard
              title="연인원"
              unit="회"
              value={report.total.attendanceCount}
              hint="기간 안의 참여 횟수 합계"
              onSelect={() => setSelection({ label: `전체 · ${periodLabel}`, match: () => true })}
            />
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)]">
            <h2 className="border-b border-[var(--color-border)] px-5 py-3 text-base font-semibold">
              수업별
            </h2>
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="px-5 py-2 font-medium">수업</th>
                  <th className="px-3 py-2 text-right font-medium">실인원</th>
                  <th className="px-3 py-2 text-right font-medium">연인원</th>
                  <th className="hidden w-1/3 px-5 py-2 font-medium sm:table-cell">
                    <span className="sr-only">연인원 비교</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.byCourse.map((row) => (
                  <tr key={row.courseId} className="border-t border-[var(--color-border)]">
                    <td className="px-5 py-2">{row.courseName}</td>
                    <NumberCell
                      value={row.uniqueParticipants}
                      unit="명"
                      onSelect={() =>
                        setSelection({
                          label: row.courseName,
                          match: (evidence) => evidence.courseId === row.courseId,
                        })
                      }
                    />
                    <NumberCell
                      value={row.attendanceCount}
                      unit="회"
                      onSelect={() =>
                        setSelection({
                          label: row.courseName,
                          match: (evidence) => evidence.courseId === row.courseId,
                        })
                      }
                    />
                    <td className="hidden px-5 py-2 sm:table-cell">
                      <div className="h-2 rounded-full bg-[var(--color-muted)]">
                        <div
                          className="h-2 rounded-full bg-[var(--color-primary)]"
                          style={{ width: `${(row.attendanceCount / maxCourseCount) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-[var(--color-border)] px-5 py-2 text-xs text-[var(--color-muted-foreground)]">
              한 사람이 여러 수업에 참여하면 수업별 실인원의 합이 전체 실인원보다 클 수 있습니다.
            </p>
          </section>

          <CrossTabSection report={report} onSelect={setSelection} />

          <div className="grid gap-6 lg:grid-cols-3">
            <BreakdownTable
              title="성별"
              rows={report.byGender}
              onSelect={(row) =>
                setSelection({
                  label: `성별 · ${row.label}`,
                  match: (evidence) => (evidence.gender ?? 'unknown') === row.key,
                })
              }
            />
            <BreakdownTable
              title="연령대"
              rows={report.byAgeBand}
              onSelect={(row) =>
                setSelection({
                  label: `연령대 · ${row.label}`,
                  match: (evidence) => evidence.ageBand === row.key,
                })
              }
            />
            <BreakdownTable
              title="장애 유무"
              rows={report.byDisability}
              onSelect={(row) =>
                setSelection({
                  label: `장애 유무 · ${row.label}`,
                  match: (evidence) => evidence.disability === row.key,
                })
              }
            />
          </div>
        </div>

        {selection ? (
          <aside
            ref={evidenceRef}
            aria-label="숫자 근거"
            className="h-fit rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] lg:sticky lg:top-4 print:hidden"
          >
            <div className="flex items-start justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">근거 기록</h2>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {selection.label} · {new Set(selectedRows.map((row) => row.participantId)).size}명 ·{' '}
                  {selectedRows.length}회
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label="근거 기록 닫기" onClick={() => setSelection(null)}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--color-card)] text-left text-[var(--color-muted-foreground)]">
                  <tr>
                    <th className="px-4 py-2 font-medium">날짜</th>
                    <th className="px-2 py-2 font-medium">참여자</th>
                    <th className="px-2 py-2 font-medium">수업</th>
                    <th className="px-4 py-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRows.map((row) => {
                    const participant = participantById.get(row.participantId);
                    return (
                      <tr key={`${row.sessionId}:${row.participantId}`} className="border-t border-[var(--color-border)]">
                        <td className="px-4 py-1.5 tabular-nums">{row.date.slice(5)}</td>
                        <td className="px-2 py-1.5">
                          {participant?.name ?? '-'}
                          {participant?.internalNo ? (
                            <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">
                              {participant.internalNo}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5">{courseNameById.get(row.courseId) ?? '-'}</td>
                        <td className="px-4 py-1.5">{row.status === 'present' ? '출석' : '부분 출석'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {selectedRows.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
                  참여 기록이 없습니다.
                </p>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
      </div>
      {printJob ? (
        <SubmissionPrint
          report={report}
          periodLabel={periodLabel}
          options={printJob.options}
          generatedAt={printJob.generatedAt}
        />
      ) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[var(--color-muted-foreground)]">{label}</span>
      {children}
    </label>
  );
}

function SummaryCard({
  title,
  unit,
  value,
  hint,
  onSelect,
}: {
  title: string;
  unit: string;
  value: number;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-left transition hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      <p className="text-sm font-medium text-[var(--color-muted-foreground)]">{title}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">
        {value.toLocaleString('ko-KR')}
        <span className="ml-1 text-base font-medium">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{hint} · 눌러서 근거 보기</p>
    </button>
  );
}

function NumberCell({ value, unit, onSelect }: { value: number; unit: string; onSelect: () => void }) {
  return (
    <td className="px-3 py-2 text-right">
      <button
        type="button"
        onClick={onSelect}
        className="rounded px-1 tabular-nums underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        {value.toLocaleString('ko-KR')}
        {unit}
      </button>
    </td>
  );
}

function BreakdownTable({
  title,
  rows,
  onSelect,
}: {
  title: string;
  rows: ParticipationBreakdownRow[];
  onSelect: (row: ParticipationBreakdownRow) => void;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)]">
      <h2 className="border-b border-[var(--color-border)] px-4 py-3 text-base font-semibold">{title}</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--color-muted-foreground)]">
          <tr>
            <th className="px-4 py-2 font-medium">구분</th>
            <th className="px-3 py-2 text-right font-medium">실인원</th>
            <th className="px-3 py-2 text-right font-medium">연인원</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-[var(--color-border)]">
              <td className="px-4 py-2">{row.label}</td>
              <NumberCell value={row.uniqueParticipants} unit="명" onSelect={() => onSelect(row)} />
              <NumberCell value={row.attendanceCount} unit="회" onSelect={() => onSelect(row)} />
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-center text-sm text-[var(--color-muted-foreground)]">
          참여 기록이 없습니다.
        </p>
      ) : null}
    </section>
  );
}

