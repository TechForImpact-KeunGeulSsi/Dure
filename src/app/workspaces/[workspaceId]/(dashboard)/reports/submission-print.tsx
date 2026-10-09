'use client';

import type { UUID } from '@/lib/api/types';
import type { ParticipationReportOutput } from '@/services/participation-report';
import { buildMonthlyTrend } from '@/services/participation-report-logic';
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
  });

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
