import assert from "node:assert/strict";
import test from "node:test";

import {
  MAPO_DASHBOARD_WORKSPACE_NAME,
  buildMapoDashboardFixture,
} from "./mapo-dashboard-fixture.mjs";
import { deterministicUuid } from "./developer-qa-fixture.mjs";
import { buildAttendanceDashboard } from "../src/services/attendance-dashboard-logic.ts";

const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const REFERENCE_DATE = "2026-09-03";

function buildFixture() {
  return buildMapoDashboardFixture({
    workspaceId: WORKSPACE_ID,
    referenceDate: REFERENCE_DATE,
  });
}

test("마포 센터 데모 fixture는 30명·6개 수업·3개월 운영 구조를 가진다", () => {
  const fixture = buildFixture();

  assert.equal(fixture.workspace.name, MAPO_DASHBOARD_WORKSPACE_NAME);
  assert.equal(fixture.groups.length, 1);
  assert.equal(fixture.participants.length, 30);
  assert.equal(fixture.courses.length, 6);
  assert.equal(fixture.sessions.length, 78);
  assert.equal(fixture.attendanceRecords.length, 380);
  assert.equal(fixture.classMemos.length, 6);
  assert.deepEqual(
    fixture.courses.map((course) => course.name),
    ["생활체육교실", "미술활동", "음악교실", "요리활동", "디지털활동", "일상생활훈련"],
  );
  assert.ok(fixture.courses.every((course) => course.status === "in_progress"));
  assert.deepEqual(
    fixture.courses.slice(3).map((course) => course.instructorKey),
    ["cookingInstructor", "digitalInstructor", "dailyInstructor"],
  );
  assert.equal(fixture.sessions[0].date, "2026-06-11");
  assert.equal(
    fixture.sessions.filter((session) => session.date === REFERENCE_DATE).length,
    6,
  );
  assert.ok(
    fixture.attendanceRecords.every((record) => record.workspace_id === WORKSPACE_ID),
  );
});

test("참여자는 보고용 정보를 갖고 한 수업만 듣는다", () => {
  const fixture = buildFixture();

  assert.deepEqual(
    fixture.participants.map((participant) => participant.internal_no),
    Array.from({ length: 30 }, (_, index) => `M-${String(index + 1).padStart(4, "0")}`),
  );
  assert.equal(fixture.participants.filter((participant) => participant.gender === "female").length, 15);
  assert.equal(fixture.participants.filter((participant) => participant.gender === "male").length, 15);
  assert.equal(fixture.participants.filter((participant) => participant.has_disability).length, 19);
  assert.ok(fixture.participants.every((participant) => Number.isInteger(participant.birth_year)));

  for (const participant of fixture.participants) {
    const active = fixture.courseParticipants.filter(
      (row) => row.participant_id === participant.id && row.status === "active",
    );
    assert.equal(active.length, 1, `${participant.key} must have exactly one active course`);
  }
  for (const course of fixture.courses) {
    assert.equal(
      fixture.courseParticipants.filter((row) => row.course_id === course.id && row.status === "active").length,
      5,
    );
  }

  const sameName = fixture.participants.filter((participant) => participant.name === "이수민");
  assert.equal(sameName.length, 2);
  assert.notEqual(sameName[0].courseKey, sameName[1].courseKey);
});

test("휴강 회차와 중단 기간은 기록 규칙을 따른다", () => {
  const fixture = buildFixture();
  const cancelled = fixture.sessions.filter((session) => session.progress_status === "cancelled");

  assert.deepEqual(cancelled.map((session) => session.key), ["cooking-7"]);
  assert.equal(
    fixture.attendanceRecords.filter((record) => record.session_id === cancelled[0].id).length,
    0,
  );
  const breakNotes = fixture.attendanceRecords.filter(
    (record) => record.participant_id === deterministicUuid(WORKSPACE_ID, "participant:dohyun") && record.note,
  );
  assert.equal(breakNotes.length, 3);
  assert.ok(breakNotes.every((record) => record.status === "absent"));
});

test("대시보드 계산은 저출석·정확히 50%·미입력 기대값과 일치한다", () => {
  const fixture = buildFixture();
  const participantById = new Map(fixture.participants.map((participant) => [participant.id, participant]));
  const projection = buildAttendanceDashboard({
    selectedDate: fixture.referenceDate,
    now: `${fixture.referenceDate}T18:00:00+09:00`,
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
        participantName: participantById.get(row.participant_id).name,
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

  assert.equal(projection.summary.missingAttendanceCount, fixture.expected.dailyMissingCount);
  assert.equal(projection.summary.lowAttendanceParticipantCount, fixture.expected.lowAttendance.length);

  const findResult = ({ courseKey, participantKey }) => {
    const course = projection.courses.find(
      (item) => item.id === deterministicUuid(WORKSPACE_ID, `course:${courseKey}`),
    );
    const participant = course.participants.find(
      (item) => item.participantId === deterministicUuid(WORKSPACE_ID, `participant:${participantKey}`),
    );
    return { course, participant };
  };
  for (const boundary of fixture.expected.lowAttendance) {
    const { course, participant } = findResult(boundary);
    assert.deepEqual(
      { attended: participant.attendedSessionCount, valid: participant.validSessionCount },
      { attended: boundary.attended, valid: boundary.valid },
    );
    assert.ok(course.lowAttendanceParticipantIds.includes(participant.participantId));
  }
  for (const boundary of fixture.expected.exactFifty) {
    const { course, participant } = findResult(boundary);
    assert.deepEqual(
      { attended: participant.attendedSessionCount, valid: participant.validSessionCount },
      { attended: boundary.attended, valid: boundary.valid },
    );
    assert.equal(course.lowAttendanceParticipantIds.includes(participant.participantId), false);
  }
  for (const course of fixture.courses) {
    const session = projection.courses.find((item) => item.id === course.id).dailySessions[0];
    assert.deepEqual(
      {
        present: session.presentCount,
        partial: session.partialCount,
        absent: session.absentCount,
        missing: session.missingAttendanceCount,
      },
      fixture.expected.todaySessionCounts[course.key],
    );
  }
});
