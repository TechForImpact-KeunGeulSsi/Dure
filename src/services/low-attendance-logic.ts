import type { UUID } from "@/lib/api/types";

import type {
  AttendanceDashboardCourse,
  AttendanceDashboardSessionHistory,
} from "./attendance-dashboard-logic";

// 월 저출석자 (PR 통합 문서 7.1·9장 초안, 센터 확인 전)
// - 그 달에 끝난 회차 중 출석 기록이 있는 회차를 분모로 쓴다. 미입력 칸은 세지 않는다.
// - 출석과 부분 출석을 참여로 센다.
// - 기록이 있는 회차가 2회 이상이고 출석률이 50% 미만이면 저출석이다. 정확히 50%는 저출석이 아니다.

export const MIN_MONTHLY_SESSIONS = 2;

export type MonthlyLowAttendanceRow = {
  courseId: UUID;
  courseName: string;
  participantId: UUID;
  participantName: string;
  attendedCount: number;
  validCount: number;
  missingCount: number;
  rate: number;
  sessions: AttendanceDashboardSessionHistory[];
};

export function buildMonthlyLowAttendance(
  courses: AttendanceDashboardCourse[],
  month: string,
): MonthlyLowAttendanceRow[] {
  const rows: MonthlyLowAttendanceRow[] = [];
  for (const course of courses) {
    for (const participant of course.participants) {
      const sessions = participant.sessionHistory.filter((session) => session.date.startsWith(month));
      const valid = sessions.filter((session) => session.status !== "missing");
      const attended = valid.filter(
        (session) => session.status === "present" || session.status === "partial",
      ).length;
      if (valid.length < MIN_MONTHLY_SESSIONS || attended * 2 >= valid.length) continue;
      rows.push({
        courseId: course.id,
        courseName: course.name,
        participantId: participant.participantId,
        participantName: participant.participantName,
        attendedCount: attended,
        validCount: valid.length,
        missingCount: sessions.length - valid.length,
        rate: Math.round((attended / valid.length) * 1000) / 10,
        sessions,
      });
    }
  }
  return rows.sort(
    (left, right) =>
      left.rate - right.rate ||
      left.courseName.localeCompare(right.courseName, "ko") ||
      left.participantName.localeCompare(right.participantName, "ko"),
  );
}

export function recentMonths(today: string, count: number): string[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
