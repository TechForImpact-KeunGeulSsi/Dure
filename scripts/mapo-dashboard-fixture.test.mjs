import assert from "node:assert/strict";
import test from "node:test";

import {
  MAPO_DASHBOARD_WORKSPACE_NAME,
  buildMapoDashboardFixture,
} from "./mapo-dashboard-fixture.mjs";
import { deterministicUuid } from "./developer-qa-fixture.mjs";

const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const REFERENCE_DATE = "2026-09-03";

test("마포 센터 데모 fixture는 대시보드 설명용 운영 구조를 가진다", () => {
  const fixture = buildMapoDashboardFixture({
    workspaceId: WORKSPACE_ID,
    referenceDate: REFERENCE_DATE,
  });

  assert.equal(fixture.workspace.name, MAPO_DASHBOARD_WORKSPACE_NAME);
  assert.equal(fixture.groups.length, 1);
  assert.equal(fixture.participants.length, 12);
  assert.equal(fixture.courses.length, 3);
  assert.equal(fixture.sessions.length, 18);
  assert.equal(fixture.attendanceRecords.length, 112);
  assert.equal(fixture.classMemos.length, 3);
  assert.deepEqual(
    fixture.courses.map((course) => course.name),
    ["생활체육교실", "미술활동", "음악교실"],
  );
  assert.ok(
    fixture.courses.every((course) => course.status === "in_progress"),
  );
  assert.equal(
    fixture.courses.find((course) => course.key === "fitness").instructorKey,
    "fitnessInstructor",
  );
  assert.equal(
    fixture.sessions.filter((session) => session.date === REFERENCE_DATE).length,
    3,
  );
  assert.equal(
    fixture.attendanceRecords.filter((record) => record.session_id === deterministicUuid(WORKSPACE_ID, "session:art-6")).length,
    5,
  );
  assert.ok(
    fixture.courseParticipants.some((row) => row.status === "excluded"),
  );
});

test("마포 센터 데모 fixture는 저출석 경계 사례를 포함한다", () => {
  const fixture = buildMapoDashboardFixture({
    workspaceId: WORKSPACE_ID,
    referenceDate: REFERENCE_DATE,
  });

  const fitnessRisk = fixture.attendanceRecords.filter(
    (record) =>
      record.participant_id === deterministicUuid(WORKSPACE_ID, "participant:haneul") &&
      fixture.sessions.some(
        (session) =>
          session.id === record.session_id &&
          session.course_id === deterministicUuid(WORKSPACE_ID, "course:fitness"),
      ),
  );
  const exactFifty = fixture.attendanceRecords.filter(
    (record) =>
      record.participant_id === deterministicUuid(WORKSPACE_ID, "participant:jihu") &&
      fixture.sessions.some(
        (session) =>
          session.id === record.session_id &&
          session.course_id === deterministicUuid(WORKSPACE_ID, "course:fitness"),
      ),
  );

  assert.equal(fitnessRisk.filter((record) => ["present", "partial"].includes(record.status)).length, 2);
  assert.equal(fitnessRisk.length, 6);
  assert.ok(exactFifty.some((record) => record.status === "absent"));
  assert.ok(
    fixture.attendanceRecords.every((record) => record.workspace_id === WORKSPACE_ID),
  );
});
