import assert from "node:assert/strict";
import test from "node:test";

import {
  DARORI_TEST_ACCOUNTS,
  DARORI_TEST_COURSES,
  DARORI_TEST_GROUPS,
  DARORI_TEST_PARTICIPANTS,
  buildDaroriGoogleFormAssignmentRows,
  buildDaroriGoogleFormSeedSpecs,
  buildDaroriSeedSummary,
} from "./seed-darori-user-test.mjs";

test("darori seed data matches the user test guide contract", () => {
  assert.deepEqual(
    DARORI_TEST_ACCOUNTS.map((account) => account.email),
    [
      "darori.owner@test.local",
      "darori.instructor@test.local",
      "darori.group@test.local",
    ],
  );
  assert.ok(DARORI_TEST_ACCOUNTS.every((account) => account.password === "123456"));
  assert.equal(DARORI_TEST_GROUPS.length, 7);
  assert.equal(DARORI_TEST_PARTICIPANTS.length, 32);
  assert.equal(DARORI_TEST_COURSES.length, 9);
  assert.equal(
    DARORI_TEST_COURSES.filter((course) => course.status === "in_progress").length,
    5,
  );
  assert.equal(
    DARORI_TEST_COURSES.filter((course) => course.status === "completed").length,
    2,
  );
  assert.equal(
    DARORI_TEST_COURSES.filter((course) => course.status === "planned").length,
    2,
  );
});

test("darori seed summary is safe to render in dry-run mode", () => {
  assert.deepEqual(buildDaroriSeedSummary(), {
    workspace: "다로리인 유저테스트",
    accounts: 3,
    groups: 7,
    participants: 32,
    courses: 9,
    materials: 2,
    attendanceSessions: 2,
    activityLogs: 8,
  });
});

test("google form seed specs create isolated owner and instructor assignments", () => {
  const specs = buildDaroriGoogleFormSeedSpecs({
    ownerCount: 10,
    instructorCount: 10,
  });
  const rows = buildDaroriGoogleFormAssignmentRows(specs);

  assert.equal(specs.length, 20);
  assert.equal(rows.length, 20);
  assert.deepEqual(
    rows.map((row) => row.participantId),
    [
      "owner01",
      "owner02",
      "owner03",
      "owner04",
      "owner05",
      "owner06",
      "owner07",
      "owner08",
      "owner09",
      "owner10",
      "instructor01",
      "instructor02",
      "instructor03",
      "instructor04",
      "instructor05",
      "instructor06",
      "instructor07",
      "instructor08",
      "instructor09",
      "instructor10",
    ],
  );
  assert.equal(rows[0].role, "대표 운영자");
  assert.equal(rows[0].email, "darori.owner+owner01@test.local");
  assert.equal(rows[0].workspace, "다로리인 유저테스트 owner01");
  assert.equal(rows[10].role, "강사");
  assert.equal(rows[10].email, "darori.instructor+instructor01@test.local");
  assert.equal(rows[10].workspace, "다로리인 유저테스트 instructor01");
  assert.ok(rows.every((row) => row.password === "123456"));
});
