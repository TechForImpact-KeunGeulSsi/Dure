import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReviewMaterialProposal,
  buildReviewMaterialProposalEvidence,
  buildReviewMaterialSourceFingerprint,
  validateReviewMaterialProposalTarget,
  validateReviewMaterialTransition,
} from "../src/services/ontology-action-contract.ts";

const WORKSPACE_ID = "workspace-1";
const MATERIAL_ID = "material-1";
const COURSE_ID = "course-1";
const UPDATED_AT = "2026-08-05T00:00:00.000Z";

test("동일한 자료 버전은 동일 fingerprint를 만들고 updated_at 변경은 fingerprint를 바꾼다", () => {
  const first = buildReviewMaterialSourceFingerprint({
    workspaceId: WORKSPACE_ID,
    materialId: MATERIAL_ID,
    targetUpdatedAt: UPDATED_AT,
  });
  const equivalent = buildReviewMaterialSourceFingerprint({
    workspaceId: WORKSPACE_ID,
    materialId: MATERIAL_ID,
    targetUpdatedAt: "2026-08-05T09:00:00+09:00",
  });
  const changed = buildReviewMaterialSourceFingerprint({
    workspaceId: WORKSPACE_ID,
    materialId: MATERIAL_ID,
    targetUpdatedAt: "2026-08-05T00:00:01.000Z",
  });

  assert.equal(first.ok, true);
  assert.equal(equivalent.ok, true);
  assert.equal(changed.ok, true);
  assert.equal(first.data, equivalent.data);
  assert.notEqual(first.data, changed.data);
  assert.match(first.data, /^sha256:[0-9a-f]{64}$/);
});

test("업로드 완료·pending 자료만 executable proposal contract를 만든다", () => {
  const proposal = buildReviewMaterialProposal({
    workspaceId: WORKSPACE_ID,
    material: material(),
    sourceTask: sourceTask(),
  });

  assert.equal(proposal.ok, true);
  assert.equal(proposal.data.action_type, "review_material");
  assert.equal(proposal.data.action_version, 1);
  assert.equal(proposal.data.target_id, MATERIAL_ID);
  assert.equal(proposal.data.target_version, UPDATED_AT);
  assert.deepEqual(proposal.data.parameters, { reviewStatus: "reviewed" });
  assert.deepEqual(
    proposal.data.evidence.evidence.map((evidence) => evidence.entityType),
    ["material", "course"],
  );
});

test("unsupported material states do not produce an executable proposal", () => {
  const failedUpload = validateReviewMaterialProposalTarget({
    ...material(),
    upload_status: "failed",
  });
  const alreadyReviewed = validateReviewMaterialProposalTarget({
    ...material(),
    review_status: "reviewed",
  });

  assert.deepEqual(
    { ok: failedUpload.ok, code: failedUpload.ok ? undefined : failedUpload.code },
    { ok: false, code: "MATERIAL_NOT_UPLOADED" },
  );
  assert.deepEqual(
    { ok: alreadyReviewed.ok, code: alreadyReviewed.ok ? undefined : alreadyReviewed.code },
    { ok: false, code: "MATERIAL_NOT_PENDING" },
  );
  assert.equal(
    buildReviewMaterialProposal({
      workspaceId: WORKSPACE_ID,
      material: { ...material(), review_status: "reviewed" },
      sourceTask: sourceTask(),
    }).ok,
    false,
  );
});

test("transition validation rejects stale versions and accepts pending to reviewed", () => {
  const valid = validateReviewMaterialTransition({
    current: material(),
    expectedTargetVersion: UPDATED_AT,
  });
  const stale = validateReviewMaterialTransition({
    current: { ...material(), updated_at: "2026-08-05T00:00:01.000Z" },
    expectedTargetVersion: UPDATED_AT,
  });

  assert.deepEqual(valid, {
    ok: true,
    data: { from: "pending", to: "reviewed", targetVersion: UPDATED_AT },
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "STALE_TARGET_VERSION");
});

test("proposal evidence requires the material and course evidence for the same target", () => {
  const missingCourse = buildReviewMaterialProposalEvidence({
    task: {
      ...sourceTask(),
      evidence: sourceTask().evidence.filter((evidence) => evidence.entityType !== "course"),
    },
    materialId: MATERIAL_ID,
    courseId: COURSE_ID,
  });

  assert.equal(missingCourse.ok, false);
  assert.equal(missingCourse.code, "INVALID_SOURCE_TASK");
});

function material() {
  return {
    id: MATERIAL_ID,
    course_id: COURSE_ID,
    title: "1회차 자료",
    upload_status: "uploaded",
    review_status: "pending",
    created_at: "2026-08-04T00:00:00.000Z",
    updated_at: UPDATED_AT,
  };
}

function sourceTask() {
  return {
    id: `pending-material-review:${MATERIAL_ID}`,
    type: "pending_material_review",
    priority: "medium",
    title: "확인이 필요한 수업 자료",
    summary: "운영 수업의 자료가 확인 대기 중입니다.",
    evidence: [
      {
        entityType: "material",
        entityId: MATERIAL_ID,
        label: "1회차 자료",
        reason: "업로드가 완료됐지만 review_status가 pending입니다.",
        metadata: { uploadStatus: "uploaded", reviewStatus: "pending" },
      },
      {
        entityType: "course",
        entityId: COURSE_ID,
        label: "운영 수업",
        reason: "자료가 속한 수업입니다.",
      },
    ],
    relatedHref: `/workspaces/${WORKSPACE_ID}/courses/${COURSE_ID}/materials`,
    recommendedManualAction: "수업 자료 화면에서 내용을 확인하세요.",
  };
}
