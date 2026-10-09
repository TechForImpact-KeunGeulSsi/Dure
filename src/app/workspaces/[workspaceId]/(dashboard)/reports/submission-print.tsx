'use client';

import type { UUID } from '@/lib/api/types';
import type { ParticipationReportOutput } from '@/services/participation-report';
import {
  buildCrossTab,
  buildMonthlyTrend,
  type CrossTab,
  type CrossTabDimension,
} from '@/services/participation-report-logic';
import { buildSubmissionSheets, type SubmissionOptions } from '@/services/report-export-logic';

import { ReportCharts } from './report-charts';

// 인쇄·PDF용 제출 파일. 엑셀과 같은 시트 내용을 그대로 표로 그린다. 화면에는 보이지 않는다.
export function SubmissionPrint({
  report,
  periodLabel,
  options,
  generatedAt,
}: {
  report: ParticipationReportOutput;
  periodLabel: string;
  options: SubmissionOptions;
  generatedAt: string;
}) {
  const sheets = buildSubmissionSheets({
    report,
    courseNames: new Map(report.courseOptions.map((course) => [course.id as UUID, course.name])),
    participantNames: new Map(
      report.participants.map((participant) => [participant.id as UUID, participant.name]),
    ),
    periodLabel,
    missingRecordCount: report.missingRecordCount,
    generatedAt,
    options,
    monthlyTrend: buildMonthlyTrend(report.period, report.evidence),
    crossTabs: (['gender', 'disability', 'ageBand'] as const).map((dimension) =>
      buildCrossTab(report, dimension),
    ),
  });

  const allowed: Record<CrossTabDimension, boolean> = {
    gender: options.includeGender,
    disability: options.includeDisability,
    ageBand: options.includeAgeBand,
  };
  const crossTabs = (['gender', 'disability', 'ageBand'] as const)
    .filter((dimension) => allowed[dimension])
    .map((dimension) => buildCrossTab(report, dimension));

  return (
    <div className="hidden space-y-6 text-[11pt] text-black print:block">
      <h1 className="text-xl font-semibold">{periodLabel} 참여 실적</h1>
      <ReportCharts
        periodLabel={periodLabel}
        trend={buildMonthlyTrend(report.period, report.evidence)}
        byCourse={report.byCourse}
        byGender={options.includeGender ? report.byGender : []}
        byDisability={options.includeDisability ? report.byDisability : []}
        byAgeBand={options.includeAgeBand ? report.byAgeBand : []}
      />
      {sheets.map((sheet) => {
        if (sheet.name === '교차표') {
          return (
            <section key={sheet.name} className="space-y-4">
              <h2 className="text-base font-semibold">교차표</h2>
              {crossTabs.map((table) => (
                <PrintCrossTab key={table.dimension} table={table} />
              ))}
            </section>
          );
        }
        const isList = sheet.name === '참여자 명단';
        const [header, ...body] = sheet.rows;
        return (
          <section key={sheet.name} className="space-y-2" style={{ breakBefore: sheet.name === '요약' ? 'page' : 'auto' }}>
            <h2 className="text-base font-semibold">{sheet.name}</h2>
            <table className="w-full border-collapse">
              {isList ? (
                <thead>
                  <tr>
                    {header.map((cell, index) => (
                      <th key={index} className="border border-black px-2 py-1 text-left">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {(isList ? body : sheet.rows).map((row, rowIndex) =>
                  row.length === 0 ? (
                    <tr key={rowIndex}>
                      <td className="py-1" colSpan={3} />
                    </tr>
                  ) : row.length === 1 && !isList ? (
                    <tr key={rowIndex} className="break-after-avoid">
                      <td className="pt-2 pb-1 font-semibold" colSpan={20}>
                        {row[0]}
                      </td>
                    </tr>
                  ) : (
                    <tr key={rowIndex} className="break-inside-avoid">
                      {row.map((cell, index) => (
                        <td key={index} className="border border-black px-2 py-1">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

// 인쇄용 교차표: 구분마다 명(실인원)·회(연인원) 두 칸, 머리줄은 두 단
function PrintCrossTab({ table }: { table: CrossTab }) {
  const cell = 'border border-black px-1.5 py-0.5 text-right tabular-nums';
  const head = 'border border-black px-1.5 py-0.5 text-center font-semibold';
  return (
    <div className="break-inside-avoid space-y-1">
      <h3 className="text-[10.5pt] font-semibold">{table.title}</h3>
      <table className="w-full border-collapse text-[9pt]">
        <thead>
          <tr>
            <th rowSpan={2} className={head + ' text-left'}>
              수업
            </th>
            {table.columns.map((column) => (
              <th key={column.key} colSpan={2} className={head}>
                {column.label}
              </th>
            ))}
            <th colSpan={2} className={head}>
              합계
            </th>
          </tr>
          <tr>
            {[...table.columns, { key: 'total', label: '합계' }].flatMap((column) => [
              <th key={column.key + '-u'} className={head + ' font-normal'}>
                명
              </th>,
              <th key={column.key + '-c'} className={head + ' font-normal'}>
                회
              </th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {[
            ...table.rows.map((row) => ({ name: row.courseName, cells: row.cells, total: row.total, bold: false })),
            { name: '합계(중복 제외)', cells: table.totalRow.cells, total: table.totalRow.total, bold: true },
          ].map((row) => (
            <tr key={row.name} className={row.bold ? 'font-semibold' : undefined}>
              <td className="whitespace-nowrap border border-black px-1.5 py-0.5">{row.name}</td>
              {table.columns.flatMap((column) => [
                <td key={column.key + '-u'} className={cell}>
                  {row.cells[column.key].uniqueParticipants}
                </td>,
                <td key={column.key + '-c'} className={cell}>
                  {row.cells[column.key].attendanceCount}
                </td>,
              ])}
              <td className={cell}>{row.total.uniqueParticipants}</td>
              <td className={cell}>{row.total.attendanceCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
