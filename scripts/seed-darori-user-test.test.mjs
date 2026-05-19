import assert from "node:assert/strict";
import test from "node:test";

import {
  DARORI_TEST_ACCOUNTS,
  DARORI_TEST_COURSES,
  DARORI_TEST_GROUPS,
  DARORI_TEST_PARTICIPANTS,
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
