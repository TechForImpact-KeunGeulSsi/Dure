import assert from "node:assert/strict";
import test from "node:test";

import {
  DecideReviewMaterialProposalSchema,
  EnsureReviewMaterialProposalSchema,
} from "../src/lib/validators/ontology-action.ts";

const WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";
const MATERIAL_ID = "20000000-0000-0000-0000-000000000001";
const PROPOSAL_ID = "30000000-0000-0000-0000-000000000001";

test("ReviewMaterial proposal input requires UUIDs and an ISO target version", () => {
  const parsed = EnsureReviewMaterialProposalSchema.safeParse({
    workspaceId: WORKSPACE_ID,
    materialId: MATERIAL_ID,
    targetUpdatedAt: "2026-08-05T00:00:00.000Z",
  });

  assert.equal(parsed.success, true);
  assert.equal(
    EnsureReviewMaterialProposalSchema.safeParse({
      workspaceId: WORKSPACE_ID,
      materialId: MATERIAL_ID,
      targetUpdatedAt: "not-a-date",
    }).success,
    false,
  );
});

test("ReviewMaterial decision input normalizes an empty note to null", () => {
  const parsed = DecideReviewMaterialProposalSchema.safeParse({
    workspaceId: WORKSPACE_ID,
    proposalId: PROPOSAL_ID,
    decision: "reject",
    note: "   ",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.note, null);
});
