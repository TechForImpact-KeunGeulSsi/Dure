import assert from "node:assert/strict";
import test from "node:test";

import { buildAttendanceDashboard } from "../src/services/attendance-dashboard-logic.ts";

const baseInput = {
  selectedDate: "2026-09-03",
  now: "2026-09-03T18:00:00+09:00",
  timezone: "Asia/Seoul",
  courses: [
    { id: "course-1", name: "생활체육", status: "in_progress" },
    { id: "course-2", name: "음악교실", status: "in_progress" },
  ],
  sessions: [
    session("s1", "course-1", 1, "2026-09-01", "10:00:00", "11:00:00"),
    session("s2", "course-1", 2, "2026-09-02", "10:00:00", "11:00:00"),
    session("s3", "course-1", 3, "2026-09-03", "10:00:00", "11:00:00"),
    session("s4", "course-2", 1, "2026-09-10", "10:00:00", "11:00:00"),
  ],
  participants: [
    participant("p1", "김서연", "course-1", "2026-09-01T00:00:00+09:00"),
    participant("p2", "이민호", "course-1", "2026-09-02T00:00:00+09:00"),
    participant("p3", "박지우", "course-1", "2026-09-01T00:00:00+09:00"),
  ],
  records: [
    record("s1", "p1", "absent"),
    record("s2", "p1", "present"),
    record("s3", "p1", "partial"),
    record("s2", "p2", "absent"),
    record("s1", "p3", "present"),
    record("s2", "p3", "absent"),
  ],
};

test("부분 출석은 출석 1회로 계산하고 50% 미만만 저출석으로 판정한다", () => {
  const result = buildAttendanceDashboard(baseInput);
  const course = result.courses.find((item) => item.id === "course-1");
  assert.ok(course);

  const p1 = course.participants.find((item) => item.participantId === "p1");
  const p2 = course.participants.find((item) => item.participantId === "p2");
  const p3 = course.participants.find((item) => item.participantId === "p3");

  assert.deepEqual(
    { rate: p1.attendanceRate, attended: p1.attendedSessionCount, valid: p1.validSessionCount },
    { rate: 66.7, attended: 2, valid: 3 },
  );
  assert.deepEqual(
    { rate: p2.attendanceRate, attended: p2.attendedSessionCount, valid: p2.validSessionCount },
    { rate: 0, attended: 0, valid: 1 },
  );
  assert.deepEqual(
    { rate: p3.attendanceRate, attended: p3.attendedSessionCount, valid: p3.validSessionCount },
    { rate: 50, attended: 1, valid: 2 },
  );
  assert.deepEqual(course.lowAttendanceParticipantIds, ["p2"]);
});

test("참여자 배정일 이전 회차와 미입력 회차는 유효회차에서 제외한다", () => {
  const result = buildAttendanceDashboard(baseInput);
  const course = result.courses.find((item) => item.id === "course-1");
  const p2 = course.participants.find((item) => item.participantId === "p2");

  assert.equal(p2.validSessionCount, 1);
  assert.equal(p2.attendedSessionCount, 0);
  assert.equal(p2.sessionHistory.find((item) => item.sessionId === "s1"), undefined);
  assert.equal(p2.sessionHistory.find((item) => item.sessionId === "s3")?.status, "missing");
  assert.equal(course.missingAttendanceCount, 2);
  assert.equal(result.summary.missingAttendanceCount, 2);
});

test("미래 회차는 출석 미입력이나 주의 수업으로 계산하지 않는다", () => {
  const result = buildAttendanceDashboard({
    ...baseInput,
    selectedDate: "2026-09-10",
  });
  const course = result.courses.find((item) => item.id === "course-2");

  assert.equal(course.dailySessions[0].state, "upcoming");
  assert.equal(course.dailySessions[0].missingAttendanceCount, 0);
  assert.equal(course.warning, false);
});

test("제외 회차와 취소 회차는 대시보드의 유효 회차에서 제외한다", () => {
  const result = buildAttendanceDashboard({
    ...baseInput,
    sessions: [
      ...baseInput.sessions,
      { ...session("excluded", "course-1", 4, "2026-09-04", "10:00:00", "11:00:00"), rollupStatus: "excluded" },
      { ...session("cancelled", "course-1", 5, "2026-09-05", "10:00:00", "11:00:00"), progressStatus: "cancelled" },
    ],
    records: [
      ...baseInput.records,
      record("excluded", "p1", "absent"),
      record("cancelled", "p1", "absent"),
    ],
  });
  const p1 = result.courses.find((item) => item.id === "course-1").participants.find((item) => item.participantId === "p1");

  assert.equal(p1.validSessionCount, 3);
  assert.equal(p1.attendedSessionCount, 2);
});

function session(id, courseId, sessionNo, date, startsAt, endsAt) {
  return {
    id,
    courseId,
    sessionNo,
    date,
    startsAt,
    endsAt,
    rollupStatus: "included",
    progressStatus: "scheduled",
  };
}

function participant(participantId, participantName, courseId, assignedAt) {
  return { participantId, participantName, courseId, assignedAt, status: "active" };
}

function record(sessionId, participantId, status) {
  return { sessionId, participantId, status };
}
