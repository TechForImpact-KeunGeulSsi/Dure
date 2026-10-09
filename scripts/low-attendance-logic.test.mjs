import assert from "node:assert/strict";
import test from "node:test";

import { buildAttendanceDashboard } from "../src/services/attendance-dashboard-logic.ts";
import { buildMonthlyLowAttendance, recentMonths } from "../src/services/low-attendance-logic.ts";
import { buildMapoDashboardFixture } from "./mapo-dashboard-fixture.mjs";

const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

function dashboardCourses(referenceDate) {
  const fixture = buildMapoDashboardFixture({ workspaceId: WORKSPACE_ID, referenceDate });
  const nameById = new Map(fixture.participants.map((participant) => [participant.id, participant]));
  const projection = buildAttendanceDashboard({
    selectedDate: referenceDate,
    now: `${referenceDate}T18:00:00+09:00`,
    timezone: "Asia/Seoul",
    courses: fixture.courses.map((course) => ({ id: course.id, name: course.name, status: course.status })),
    sessions: fixture.sessions.map((session) => ({
      id: session.id,
      courseId: session.course_id,
      sessionNo: session.session_no,
      date: session.date,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      rollupStatus: session.rollup_status,
      progressStatus: session.progress_status,
    })),
    participants: fixture.courseParticipants
      .filter((row) => row.status === "active")
      .map((row) => ({
        participantId: row.participant_id,
        participantName: nameById.get(row.participant_id).name,
        courseId: row.course_id,
        assignedAt: row.assigned_at,
        status: "active",
      })),
    records: fixture.attendanceRecords.map((row) => ({
      sessionId: row.session_id,
      participantId: row.participant_id,
      status: row.status,
      note: row.note,
    })),
  });
  return { fixture, courses: projection.courses };
}

test("월 저출석자는 기록 2회 이상·50% 미만만 포함하고 정확히 50%는 뺀다", () => {
  const { courses } = dashboardCourses("2026-09-03");
  const rows = buildMonthlyLowAttendance(courses, "2026-08");
  const names = rows.map((row) => row.participantName).sort();

  assert.deepEqual(names, ["문지우", "백승호", "최민준"]);
  assert.ok(rows.every((row) => row.validCount >= 2 && row.attendedCount * 2 < row.validCount));
  assert.deepEqual(
    rows.map((row) => [row.participantName, row.attendedCount, row.validCount]).sort(),
    [
      ["문지우", 1, 4],
      ["백승호", 1, 4],
      ["최민준", 1, 4],
    ],
  );
  // 김하늘은 8월 2/4 = 50%라 저출석이 아니다
  assert.equal(names.includes("김하늘"), false);
});

test("기록이 2회 미만인 달은 저출석으로 보지 않는다", () => {
  const { courses } = dashboardCourses("2026-09-03");
  assert.deepEqual(buildMonthlyLowAttendance(courses, "2026-09"), []);
});

test("최근 달 목록은 연도를 넘어 거꾸로 센다", () => {
  assert.deepEqual(recentMonths("2026-02-15", 4), ["2026-02", "2026-01", "2025-12", "2025-11"]);
});
