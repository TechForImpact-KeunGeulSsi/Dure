import { addDays, format, parseISO } from "date-fns";

import type { ISODate, ISOTime } from "@/lib/api/types";

const MAX_SESSIONS = 365 * 5; // 안전 상한.

export type RecurrenceInput = {
  startsOn: ISODate;
  endsOn?: ISODate | null;
  sessionCount?: number | null;
  repeatWeekdays: number[]; // 0(Sun) ~ 6(Sat)
  startsAt: ISOTime;
  endsAt: ISOTime;
};

export type SessionPlan = {
  sessionNo: number;
  date: ISODate;
  startsAt: ISOTime;
  endsAt: ISOTime;
};

/**
 * Generates the list of sessions implied by a recurrence rule.
 * - Exactly one of `endsOn` / `sessionCount` must be set (caller's responsibility — Zod enforces).
 * - Weekdays use Sunday=0 convention to match Postgres `extract(dow ...)` and JS `Date.getDay()`.
 * - Dates are produced in YYYY-MM-DD form, treated as wall-clock in the workspace timezone
 *   (MVP assumes Asia/Seoul — see plan §위험 4).
 * - Returned list is ordered by (date, startsAt) ascending with sessionNo starting at 1.
 */
export function planSessions(input: RecurrenceInput): SessionPlan[] {
  const weekdaySet = new Set(input.repeatWeekdays);
  if (weekdaySet.size === 0) return [];

  const start = parseISO(input.startsOn);
  const result: SessionPlan[] = [];

  if (input.sessionCount != null) {
    const target = Math.max(1, input.sessionCount);
    let cursor = start;
    let safety = 0;
    while (result.length < target && safety < MAX_SESSIONS * 2) {
      if (weekdaySet.has(cursor.getDay())) {
        result.push({
          sessionNo: result.length + 1,
          date: format(cursor, "yyyy-MM-dd"),
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        });
      }
      cursor = addDays(cursor, 1);
      safety += 1;
    }
    return result;
  }

  if (input.endsOn != null) {
    const end = parseISO(input.endsOn);
    if (end < start) return [];
    let cursor = start;
    let safety = 0;
    while (cursor <= end && safety < MAX_SESSIONS) {
      if (weekdaySet.has(cursor.getDay())) {
        result.push({
          sessionNo: result.length + 1,
          date: format(cursor, "yyyy-MM-dd"),
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        });
      }
      cursor = addDays(cursor, 1);
      safety += 1;
    }
    return result;
  }

  return [];
}
