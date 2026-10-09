import type { UUID } from "@/lib/api/types";
import type { XlsxCell, XlsxSheet } from "@/lib/export/xlsx";

import type {
  ParticipationBreakdownRow,
  ParticipationReport,
} from "./participation-report-logic";

// 외부 제출 파일 (PR 통합 문서 10.3, 결정 11)
// - 내부 자료에서 열을 숨기지 않고, 허용된 항목만 골라 새로 만든다.
// - 이름은 기본 가운데 가림("홍*동"). 연락처·주소·메모·내부 번호·장애 유형은 넣지 않는다.
// - 숫자 값만 넣고 수식은 쓰지 않는다. 계산 기준은 별도 시트에 적는다.

export type SubmissionNameMode = "masked" | "none";

export type SubmissionOptions = {
  nameMode: SubmissionNameMode;
  includeGender: boolean;
  includeAgeBand: boolean;
  includeDisability: boolean;
};

export const DEFAULT_SUBMISSION_OPTIONS: SubmissionOptions = {
  nameMode: "masked",
  includeGender: true,
  includeAgeBand: true,
  includeDisability: true,
};

export type SubmissionInput = {
  report: ParticipationReport;
  courseNames: Map<UUID, string>;
  participantNames: Map<UUID, string>;
  periodLabel: string;
  missingRecordCount: number;
  generatedAt: string;
  options: SubmissionOptions;
};

export function maskName(name: string): string {
  const chars = Array.from(name.trim());
  if (chars.length <= 1) return "*";
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${"*".repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

export function buildParticipantRows(input: SubmissionInput): XlsxCell[][] {
  const { options } = input;
  const header: XlsxCell[] = ["번호"];
  if (options.nameMode === "masked") header.push("이름");
  if (options.includeGender) header.push("성별");
  if (options.includeAgeBand) header.push("연령대");
  if (options.includeDisability) header.push("장애 유무");
  header.push("수업", "참여 횟수");

  const byParticipantCourse = new Map<
    string,
    {
      participantId: UUID;
      courseId: UUID;
      count: number;
      gender: string | null;
      ageBandLabel: string;
      disability: string;
    }
  >();
  for (const row of input.report.evidence) {
    const key = `${row.participantId}:${row.courseId}`;
    const current = byParticipantCourse.get(key);
    if (current) {
      current.count += 1;
    } else {
      byParticipantCourse.set(key, {
        participantId: row.participantId,
        courseId: row.courseId,
        count: 1,
        gender: row.gender,
        ageBandLabel: row.ageBandLabel,
        disability: row.disability,
      });
    }
  }

  const entries = [...byParticipantCourse.values()]
    .map((entry) => ({
      ...entry,
      courseName: input.courseNames.get(entry.courseId) ?? "",
      name: input.participantNames.get(entry.participantId) ?? "",
    }))
    .sort(
      (left, right) =>
        left.courseName.localeCompare(right.courseName, "ko") ||
        left.name.localeCompare(right.name, "ko"),
    );

  const rows: XlsxCell[][] = [header];
  for (const [index, entry] of entries.entries()) {
    const row: XlsxCell[] = [index + 1];
    if (options.nameMode === "masked") row.push(maskName(entry.name));
    if (options.includeGender) row.push(genderLabel(entry.gender));
    if (options.includeAgeBand) row.push(entry.ageBandLabel);
    if (options.includeDisability) row.push(disabilityLabel(entry.disability));
    row.push(entry.courseName, entry.count);
    rows.push(row);
  }
  return rows;
}

export function buildSubmissionSheets(input: SubmissionInput): XlsxSheet[] {
  const { report, options } = input;
  const summary: XlsxCell[][] = [
    ["기간", input.periodLabel],
    ["시작일", report.period.startDate],
    ["종료일", report.period.endDate],
    ["실인원(명)", report.total.uniqueParticipants],
    ["연인원(회)", report.total.attendanceCount],
    [],
    ["수업", "실인원(명)", "연인원(회)"],
    ...report.byCourse.map((row) => [
      input.courseNames.get(row.courseId) ?? row.courseName,
      row.uniqueParticipants,
      row.attendanceCount,
    ]),
  ];
  const appendBreakdown = (title: string, rows: ParticipationBreakdownRow[]) => {
    summary.push([], [title, "실인원(명)", "연인원(회)"]);
    for (const row of rows) summary.push([row.label, row.uniqueParticipants, row.attendanceCount]);
  };
  if (options.includeGender) appendBreakdown("성별", report.byGender);
  if (options.includeAgeBand) appendBreakdown("연령대", report.byAgeBand);
  if (options.includeDisability) appendBreakdown("장애 유무", report.byDisability);

  const basis: XlsxCell[][] = [
    ["항목", "기준"],
    ["실인원", "기간 안에 출석 또는 부분 출석이 한 번 이상 있는 사람 수. 같은 사람은 1명으로 셉니다."],
    ["연인원", "기간 안의 출석과 부분 출석 횟수 합계입니다."],
    ["제외", "휴강 회차와 집계 제외 회차, 출석이 입력되지 않은 칸은 세지 않습니다."],
    ["합계", "수업별 숫자를 더하지 않고 원래 출석 기록에서 다시 계산합니다."],
    ["연령대", `${report.period.endDate.slice(0, 4)}년 기준 (기준연도 - 출생연도), 10세 단위`],
    ["이름", options.nameMode === "masked" ? "가운데 글자를 가렸습니다." : "넣지 않았습니다."],
    ["넣지 않은 정보", "연락처, 주소, 메모, 내부 번호, 장애 유형"],
    ["출석 미입력", input.missingRecordCount],
    ["만든 시각", input.generatedAt],
  ];

  return [
    { name: "요약", rows: summary },
    { name: "참여자 명단", rows: buildParticipantRows(input) },
    { name: "계산 기준", rows: basis },
  ];
}

function genderLabel(gender: string | null): string {
  if (gender === "female") return "여";
  if (gender === "male") return "남";
  return "미상";
}

function disabilityLabel(key: string): string {
  if (key === "yes") return "예";
  if (key === "no") return "아니오";
  return "미상";
}
