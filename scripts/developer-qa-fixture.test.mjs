import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminCopilotBriefing } from "../src/services/admin-copilot-logic.ts";
import {
  addDays,
  buildDeveloperQaFixture,
  deterministicUuid,
} from "./developer-qa-fixture.mjs";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const REFERENCE_DATE = "2026-07-26";

test("developer QA fixture uses deterministic IDs and Seoul-relative dates", () => {
  const first = buildDeveloperQaFixture({
    workspaceId: WORKSPACE_ID,
    referenceDate: REFERENCE_DATE,
  });
  const second = buildDeveloperQaFixture({
    workspaceId: WORKSPACE_ID,
    referenceDate: REFERENCE_DATE,
  });

  assert.equal(first.groups[0].id, second.groups[0].id);
  assert.equal(first.groups[0].id, deterministicUuid(WORKSPACE_ID, "group:alpha"));
  assert.equal(addDays(REFERENCE_DATE, 7), "2026-08-02");
  assert.equal(first.sessions.find((row) => row.key === "operations-4").date, "2026-07-29");
});

test("smoke fixture covers the agreed steady-state product surface", () => {
  const fixture = buildDeveloperQaFixture({
    workspaceId: WORKSPACE_ID,
    referenceDate: REFERENCE_DATE,
  });

  assert.deepEqual(new Set(fixture.groups.map((row) => row.status)), new Set(["active", "inactive"]));
  assert.deepEqual(
    new Set(fixture.courses.map((row) => row.status)),
    new Set(["planned", "in_progress", "completed"]),
  );
  assert.deepEqual(
    new Set(fixture.courses.map((row) => row.public_visibility)),
    new Set(["public", "hidden"]),
  );
  assert.ok(fixture.participants.some((row) => row.groupKeys.length > 1));
  assert.ok(fixture.courseParticipants.some((row) => row.status === "excluded"));
  assert.ok(fixture.sessions.some((row) => row.progress_status === "cancelled"));
  assert.ok(fixture.sessions.some((row) => row.visibility_status === "hidden"));
  assert.ok(fixture.sessions.some((row) => row.rollup_status === "excluded"));
  assert.deepEqual(new Set(fixture.materials.map((row) => row.review_status)), new Set(["pending", "reviewed"]));
  assert.deepEqual(new Set(fixture.feedbacks.map((row) => row.status)), new Set(["new", "reviewed"]));
  assert.deepEqual(new Set(fixture.settlements.map((row) => row.status)), new Set(["pending", "paid"]));
  assert.equal(fixture.storageFiles.length, 3);
  assert.deepEqual(fixture.expected.reviewMaterialScenario, {
    materialKey: "pending",
    courseKey: "operations",
  });
});

test("smoke fixture produces exactly one task for each Admin Copilot signal", () => {
  const fixture = buildDeveloperQaFixture({
    workspaceId: WORKSPACE_ID,
    referenceDate: REFERENCE_DATE,
  });
  const activeParticipantCourses = fixture.courseParticipants
    .filter((row) => row.status === "active")
    .map((row) => ({ course_id: row.course_id, participant_id: row.participant_id }));

  const briefing = buildAdminCopilotBriefing({
    workspaceId: WORKSPACE_ID,
    timezone: fixture.workspace.timezone,
    referenceDate: `${REFERENCE_DATE}T12:00:00+09:00`,
    courses: fixture.courses,
    sessions: fixture.sessions,
    materials: fixture.materials.filter(
      (row) => row.upload_status === "uploaded" && row.review_status === "pending",
    ),
    feedbacks: fixture.feedbacks.filter((row) => row.status === "new"),
    attendanceRecords: fixture.attendanceRecords,
    activeParticipantCourses,
  });

  const taskCounts = Object.fromEntries(
    Object.keys(fixture.expected.taskCounts).map((type) => [
      type,
      briefing.tasks.filter((task) => task.type === type).length,
    ]),
  );

  assert.deepEqual(taskCounts, fixture.expected.taskCounts);
  assert.equal(briefing.summary.upcomingSessionCount, fixture.expected.upcomingSessionCount);
  assert.equal(briefing.summary.recentSessionCount, fixture.expected.recentSessionCount);
});
