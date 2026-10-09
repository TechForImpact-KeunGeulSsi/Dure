'use client';

import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import type { UUID } from '@/lib/api/types';
import { reportQueryToParams, type ReportQuery } from '@/lib/reports/report-query';
import type { ParticipationReportOutput } from '@/services/participation-report';
import type { ReportExportItem } from '@/services/report-exports';
import {
  DEFAULT_SUBMISSION_OPTIONS,
  buildParticipantRows,
  type SubmissionOptions,
} from '@/services/report-export-logic';

const PREVIEW_ROWS = 5;

type SubmissionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  query: ReportQuery;
  periodLabel: string;
  report: ParticipationReportOutput;
  onPrint: (options: SubmissionOptions) => void;
  onDownloaded: () => void;
  exports: ReportExportItem[];
};

export function SubmissionDialog({
  open,
  onOpenChange,
  workspaceId,
  query,
  periodLabel,
  report,
  onPrint,
  onDownloaded,
  exports,
}: SubmissionDialogProps) {
  const [options, setOptions] = useState<SubmissionOptions>(DEFAULT_SUBMISSION_OPTIONS);
  const [missingConfirmed, setMissingConfirmed] = useState(false);

  const rows = useMemo(
    () =>
      buildParticipantRows({
        report,
        courseNames: new Map(report.courseOptions.map((course) => [course.id as UUID, course.name])),
        participantNames: new Map(
          report.participants.map((participant) => [participant.id as UUID, participant.name]),
        ),
        periodLabel,
        missingRecordCount: report.missingRecordCount,
        generatedAt: '',
        options,
      }),
    [report, periodLabel, options],
  );

  const downloadHref = useMemo(() => {
    const params = reportQueryToParams(query);
    params.set('name', options.nameMode);
    const fields = [
      options.includeGender && 'gender',
      options.includeAgeBand && 'age',
      options.includeDisability && 'disability',
    ].filter(Boolean);
    params.set('fields', fields.join(','));
    return `/api/workspaces/${workspaceId}/reports/export?${params.toString()}`;
  }, [workspaceId, query, options]);

  const blocked = report.missingRecordCount > 0 && !missingConfirmed;
  const toggle = (key: keyof Omit<SubmissionOptions, 'nameMode'>) =>
    setOptions((current) => ({ ...current, [key]: !current[key] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-2xl">
      <DialogHeader
        title="제출 파일 만들기"
        description={`${periodLabel} · 허용된 항목만 담아 새 파일로 만듭니다. 연락처·주소·메모·내부 번호·장애 유형은 넣지 않습니다.`}
      />
      <DialogBody>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">넣을 항목</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.nameMode === 'masked'}
                onChange={() =>
                  setOptions((current) => ({
                    ...current,
                    nameMode: current.nameMode === 'masked' ? 'none' : 'masked',
                  }))
                }
              />
              이름 (가운데 가림)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={options.includeGender} onChange={() => toggle('includeGender')} />
              성별
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={options.includeAgeBand} onChange={() => toggle('includeAgeBand')} />
              연령대
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeDisability}
                onChange={() => toggle('includeDisability')}
              />
              장애 유무
            </label>
          </div>
        </fieldset>

        <section aria-label="참여자 명단 미리보기" className="space-y-2">
          <h3 className="text-sm font-medium">
            참여자 명단 미리보기 · 전체 {Math.max(rows.length - 1, 0)}줄 중 {Math.min(PREVIEW_ROWS, rows.length - 1)}줄
          </h3>
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-muted)] text-left">
                <tr>
                  {rows[0].map((cell) => (
                    <th key={String(cell)} className="px-3 py-2 font-medium">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1, PREVIEW_ROWS + 1).map((row) => (
                  <tr key={String(row[0])} className="border-t border-[var(--color-border)]">
                    {row.map((cell, index) => (
                      <td key={index} className="px-3 py-1.5">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            엑셀에는 요약, 참여자 명단, 계산 기준 시트가 들어갑니다. 숫자 값만 넣고 수식은 쓰지 않습니다.
          </p>
        </section>

        <section aria-label="최근 만든 제출 파일" className="space-y-2">
          <h3 className="text-sm font-medium">최근 만든 제출 파일</h3>
          {exports.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">아직 만든 제출 파일이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm">
              {exports.slice(0, 5).map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                  <span>
                    <span className="font-medium">{item.periodLabel}</span>
                    <span className="ml-2 text-[var(--color-muted-foreground)]">
                      {item.format === 'xlsx' ? '엑셀' : '인쇄·PDF'} · 명단 {item.participantRowCount}줄
                      {item.options.nameMode === 'masked' ? ' · 이름 가림' : ' · 이름 없음'}
                    </span>
                  </span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {item.createdByName ?? '알 수 없음'} ·{' '}
                    {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(
                      new Date(item.createdAt),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {report.missingRecordCount > 0 ? (
          <div className="space-y-2 rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              출석이 입력되지 않은 칸이 {report.missingRecordCount}건 있습니다. 지금 내보내면 숫자가 실제보다
              적을 수 있습니다.
            </p>
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={missingConfirmed}
                onChange={(event) => setMissingConfirmed(event.target.checked)}
              />
              확인했습니다. 이대로 내보냅니다.
            </label>
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          취소
        </Button>
        <Button
          variant="outline"
          disabled={blocked}
          onClick={() => {
            onOpenChange(false);
            onPrint(options);
          }}
        >
          인쇄·PDF
        </Button>
        {blocked ? (
          <Button disabled>엑셀 내려받기</Button>
        ) : (
          <a
            href={downloadHref}
            download
            onClick={onDownloaded}
            className="inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
          >
            엑셀 내려받기
          </a>
        )}
      </DialogFooter>
    </Dialog>
  );
}
