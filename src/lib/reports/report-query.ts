import {
  monthPeriod,
  quarterPeriod,
  yearPeriod,
  type ParticipationReportPeriod,
} from "@/services/participation-report-logic";

export type ReportQuery = {
  unit: "month" | "quarter" | "year";
  year: number;
  quarter: 1 | 2 | 3 | 4;
  month: number;
  courseId: string | null;
  gender: "female" | "male" | null;
  disability: "yes" | "no" | null;
  ageBand: string | null;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function intInRange(value: string | undefined, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function parseReportQuery(raw: RawParams, today: string): ReportQuery {
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const unitRaw = first(raw.unit);
  const gender = first(raw.gender);
  const disability = first(raw.disability);
  const age = first(raw.age);
  const course = first(raw.course);
  return {
    unit: unitRaw === "month" || unitRaw === "year" ? unitRaw : "quarter",
    year: intInRange(first(raw.year), 2000, 2100, thisYear),
    quarter: intInRange(first(raw.quarter), 1, 4, Math.ceil(thisMonth / 3)) as 1 | 2 | 3 | 4,
    month: intInRange(first(raw.month), 1, 12, thisMonth),
    courseId: course && /^[0-9a-f-]{36}$/i.test(course) ? course : null,
    gender: gender === "female" || gender === "male" ? gender : null,
    disability: disability === "yes" || disability === "no" ? disability : null,
    ageBand: age && /^\d{1,3}$/.test(age) ? age : null,
  };
}

export function reportQueryToParams(query: ReportQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set("unit", query.unit);
  params.set("year", String(query.year));
  if (query.unit === "quarter") params.set("quarter", String(query.quarter));
  if (query.unit === "month") params.set("month", String(query.month));
  if (query.courseId) params.set("course", query.courseId);
  if (query.gender) params.set("gender", query.gender);
  if (query.disability) params.set("disability", query.disability);
  if (query.ageBand) params.set("age", query.ageBand);
  return params;
}

export function reportPeriod(query: ReportQuery): ParticipationReportPeriod {
  if (query.unit === "month") return monthPeriod(query.year, query.month);
  if (query.unit === "year") return yearPeriod(query.year);
  return quarterPeriod(query.year, query.quarter);
}

export function reportPeriodLabel(query: ReportQuery): string {
  if (query.unit === "month") return `${query.year}년 ${query.month}월`;
  if (query.unit === "quarter") return `${query.year}년 ${query.quarter}분기`;
  return `${query.year}년`;
}

export function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
