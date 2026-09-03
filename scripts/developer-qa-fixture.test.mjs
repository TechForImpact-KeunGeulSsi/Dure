import assert from "node:assert/strict";
import test from "node:test";

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
  assert.ok(
    fixture.courseParticipants.every(
      (row) => row.assigned_at === "2026-07-16T03:00:00.000Z",
    ),
  );
  assert.ok(fixture.sessions.some((row) => row.progress_status === "cancelled"));
  assert.ok(fixture.sessions.some((row) => row.visibility_status === "hidden"));
  assert.ok(fixture.sessions.some((row) => row.rollup_status === "excluded"));
  assert.deepEqual(new Set(fixture.materials.map((row) => row.review_status)), new Set(["pending", "reviewed"]));
  assert.deepEqual(new Set(fixture.materials.map((row) => row.visibility_scope)), new Set(["admin_only"]));
  // Legacy feedback/settlement rows stay in the fixture to verify data retention.
  assert.deepEqual(new Set(fixture.feedbacks.map((row) => row.status)), new Set(["new", "reviewed"]));
  assert.deepEqual(new Set(fixture.settlements.map((row) => row.status)), new Set(["pending", "paid"]));
  assert.equal(fixture.storageFiles.length, 3);
});
