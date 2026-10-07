import type { AttendanceStatus, UUID } from "@/lib/api/types";

// 보고서용 실인원·연인원 계산 (PR 통합 문서 7.1 초안 기준, 센터 확인 전)
// - 실인원: 기간 안에 한 번이라도 출석(present·partial)한 사람 수. 같은 사람은 1명.
// - 연인원: 기간 안의 출석(present·partial) 횟수 합계.
// - 휴강(cancelled)·집계 제외(excluded) 회차와 기록 없는 칸은 세지 않는다.
// - 합계는 묶음별 숫자를 더하지 않고 원래 기록에서 다시 중복을 뺀다.

export type ParticipationReportSessionInput = {
  id: UUID;
  courseId: UUID;
  date: string;
  rollupStatus: "included" | "excluded";
  progressStatus: "scheduled" | "cancelled";
};

export type ParticipationReportCourseInput = {
  id: UUID;
  name: string;
};

export type ParticipationReportParticipantInput = {
  id: UUID;
  gender: "female" | "male" | null;
  birthYear: number | null;
  hasDisability: boolean | null;
};

export type ParticipationReportRecordInput = {
  sessionId: UUID;
  participantId: UUID;
  status: AttendanceStatus;
};

export type ParticipationReportPeriod = {
  startDate: string;
  endDate: string;
};

export type ParticipationReportFilter = {
  courseIds?: UUID[];
  gender?: "female" | "male";
  hasDisability?: boolean;
  ageBand?: string;
};

export type ParticipationCount = {
  uniqueParticipants: number;
  attendanceCount: number;
};

export type ParticipationBreakdownRow = ParticipationCount & {
  key: string;
  label: string;
};

export type ParticipationReport = {
  period: ParticipationReportPeriod;
  total: ParticipationCount;
  byCourse: (ParticipationCount & { courseId: UUID; courseName: string })[];
  byGender: ParticipationBreakdownRow[];
  byAgeBand: ParticipationBreakdownRow[];
  byDisability: ParticipationBreakdownRow[];
};

type AttendedRecord = {
  participant: ParticipationReportParticipantInput;
  courseId: UUID;
};

const UNKNOWN_KEY = "unknown";

export function buildParticipationReport(input: {
  period: ParticipationReportPeriod;
  ageReferenceYear: number;
  courses: ParticipationReportCourseInput[];
  sessions: ParticipationReportSessionInput[];
  participants: ParticipationReportParticipantInput[];
  records: ParticipationReportRecordInput[];
  filter?: ParticipationReportFilter;
}): ParticipationReport {
  const filter = input.filter ?? {};
  const sessionById = new Map(input.sessions.map((session) => [session.id, session]));
  const participantById = new Map(input.participants.map((participant) => [participant.id, participant]));
  const courseFilter = filter.courseIds ? new Set(filter.courseIds) : null;

  const attended: AttendedRecord[] = [];
  for (const record of input.records) {
    if (record.status !== "present" && record.status !== "partial") continue;
    const session = sessionById.get(record.sessionId);
    if (!session || !isCountedSession(session, input.period)) continue;
    if (courseFilter && !courseFilter.has(session.courseId)) continue;
    const participant = participantById.get(record.participantId);
    if (!participant) continue;
    if (filter.gender && participant.gender !== filter.gender) continue;
    if (filter.hasDisability !== undefined && participant.hasDisability !== filter.hasDisability) continue;
    if (filter.ageBand && ageBandKey(participant.birthYear, input.ageReferenceYear) !== filter.ageBand) continue;
    attended.push({ participant, courseId: session.courseId });
  }

  const visibleCourses = courseFilter
    ? input.courses.filter((course) => courseFilter.has(course.id))
    : input.courses;

  return {
    period: input.period,
    total: countRecords(attended),
    byCourse: visibleCourses.map((course) => ({
      courseId: course.id,
      courseName: course.name,
      ...countRecords(attended.filter((record) => record.courseId === course.id)),
    })),
    byGender: breakdown(attended, (participant) => participant.gender ?? UNKNOWN_KEY, [
      ["female", "여성"],
      ["male", "남성"],
    ]),
    byAgeBand: breakdown(
      attended,
      (participant) => ageBandKey(participant.birthYear, input.ageReferenceYear),
      ageBandOrder(attended, input.ageReferenceYear),
    ),
    byDisability: breakdown(
      attended,
      (participant) =>
        participant.hasDisability === null ? UNKNOWN_KEY : participant.hasDisability ? "yes" : "no",
      [
        ["yes", "장애인"],
        ["no", "비장애인"],
      ],
    ),
  };
}

// 연령대는 기준연도 - 출생연도로 계산한다 (만 나이·기준일은 센터 확인 전).
export function ageBandKey(birthYear: number | null, referenceYear: number): string {
  if (birthYear === null) return UNKNOWN_KEY;
  const age = referenceYear - birthYear;
  if (age < 10) return "0";
  return String(Math.floor(age / 10) * 10);
}

export function ageBandLabel(key: string): string {
  if (key === UNKNOWN_KEY) return "미상";
  if (key === "0") return "10세 미만";
  return `${key}대`;
}

export function quarterPeriod(year: number, quarter: 1 | 2 | 3 | 4): ParticipationReportPeriod {
  const startMonth = (quarter - 1) * 3 + 1;
  return {
    startDate: `${year}-${pad(startMonth)}-01`,
    endDate: `${year}-${pad(startMonth + 2)}-${pad(lastDayOfMonth(year, startMonth + 2))}`,
  };
}

export function monthPeriod(year: number, month: number): ParticipationReportPeriod {
  return {
    startDate: `${year}-${pad(month)}-01`,
    endDate: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`,
  };
}

export function yearPeriod(year: number): ParticipationReportPeriod {
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

function isCountedSession(
  session: ParticipationReportSessionInput,
  period: ParticipationReportPeriod,
): boolean {
  return (
    session.rollupStatus === "included" &&
    session.progressStatus !== "cancelled" &&
    session.date >= period.startDate &&
    session.date <= period.endDate
  );
}

function countRecords(records: AttendedRecord[]): ParticipationCount {
  return {
    uniqueParticipants: new Set(records.map((record) => record.participant.id)).size,
    attendanceCount: records.length,
  };
}

function breakdown(
  records: AttendedRecord[],
  keyOf: (participant: ParticipationReportParticipantInput) => string,
  order: [string, string][],
): ParticipationBreakdownRow[] {
  const rows = order.map(([key, label]) => ({
    key,
    label,
    ...countRecords(records.filter((record) => keyOf(record.participant) === key)),
  }));
  const unknown = records.filter((record) => keyOf(record.participant) === UNKNOWN_KEY);
  if (unknown.length > 0) rows.push({ key: UNKNOWN_KEY, label: "미상", ...countRecords(unknown) });
  return rows;
}

function ageBandOrder(records: AttendedRecord[], referenceYear: number): [string, string][] {
  const keys = new Set(
    records
      .map((record) => ageBandKey(record.participant.birthYear, referenceYear))
      .filter((key) => key !== UNKNOWN_KEY),
  );
  return [...keys]
    .sort((left, right) => Number(left) - Number(right))
    .map((key) => [key, ageBandLabel(key)]);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
