import { createHash } from "node:crypto";

import type { MaterialReviewStatus, MaterialUploadStatus, UUID } from "@/lib/api/types";
import type {
  AdminCopilotEvidence,
  AdminCopilotTask,
} from "@/services/admin-copilot-logic";

export const REVIEW_MATERIAL_ACTION = {
  sourceSignalType: "pending_material_review",
  actionType: "review_material",
  actionVersion: 1,
  targetType: "material",
  proposedByKind: "deterministic_rule",
  approvalMode: "always_required",
  fromReviewStatus: "pending",
  toReviewStatus: "reviewed",
} as const;

export type ReviewMaterialTarget = {
  id: UUID;
  course_id: UUID;
  title: string;
  upload_status: MaterialUploadStatus;
  review_status: MaterialReviewStatus;
  created_at: string;
  updated_at: string;
};

export type ReviewMaterialProposalEvidence = {
  taskId: string;
  taskType: "pending_material_review";
  title: string;
  summary: string;
  relatedHref: string;
  recommendedManualAction: string;
  evidence: AdminCopilotEvidence[];
};

export type ReviewMaterialProposalContract = {
  source_signal_type: typeof REVIEW_MATERIAL_ACTION.sourceSignalType;
  source_fingerprint: string;
  action_type: typeof REVIEW_MATERIAL_ACTION.actionType;
  action_version: typeof REVIEW_MATERIAL_ACTION.actionVersion;
  target_type: typeof REVIEW_MATERIAL_ACTION.targetType;
  target_id: UUID;
  target_version: string;
  parameters: {
    reviewStatus: typeof REVIEW_MATERIAL_ACTION.toReviewStatus;
  };
  evidence: ReviewMaterialProposalEvidence;
  proposed_by_kind: typeof REVIEW_MATERIAL_ACTION.proposedByKind;
};

export type ReviewMaterialValidationCode =
  | "MATERIAL_NOT_UPLOADED"
  | "MATERIAL_NOT_PENDING"
  | "INVALID_TARGET_VERSION"
  | "STALE_TARGET_VERSION"
  | "INVALID_SOURCE_TASK";

export type ReviewMaterialValidationFailure = {
  ok: false;
  code: ReviewMaterialValidationCode;
  message: string;
};

export type ReviewMaterialValidationResult<T> =
  | { ok: true; data: T }
  | ReviewMaterialValidationFailure;

type ValidatedTargetVersion = {
  targetVersion: string;
};

/**
 * Returns the canonical version used by both the proposal and the fingerprint.
 * Supabase timestamptz values can use different equivalent offsets, so the
 * action contract compares the represented instant rather than its spelling.
 */
export function canonicalizeTargetVersion(value: string): ReviewMaterialValidationResult<string> {
  const parsed = new Date(value);
  if (!value.trim() || Number.isNaN(parsed.getTime())) {
    return invalid(
      "INVALID_TARGET_VERSION",
      "자료의 updated_at이 유효한 ISO 날짜·시간이 아닙니다.",
    );
  }
  return { ok: true, data: parsed.toISOString() };
}

/**
 * The fingerprint identifies one action contract against one object version.
 * It intentionally includes the tenant, action, target, and action version so
 * a future action/version cannot collide with this ReviewMaterial proposal.
 */
export function buildReviewMaterialSourceFingerprint(input: {
  workspaceId: UUID;
  materialId: UUID;
  targetUpdatedAt: string;
}): ReviewMaterialValidationResult<string> {
  const canonicalVersion = canonicalizeTargetVersion(input.targetUpdatedAt);
  if (!canonicalVersion.ok) return canonicalVersion;

  const canonicalPayload = JSON.stringify([
    "dure-action-fingerprint",
    REVIEW_MATERIAL_ACTION.sourceSignalType,
    REVIEW_MATERIAL_ACTION.actionType,
    REVIEW_MATERIAL_ACTION.actionVersion,
    REVIEW_MATERIAL_ACTION.targetType,
    input.workspaceId,
    input.materialId,
    canonicalVersion.data,
  ]);

  return {
    ok: true,
    data: `sha256:${createHash("sha256").update(canonicalPayload).digest("hex")}`,
  };
}

/**
 * Proposal-time validation. Only an uploaded, pending material can produce an
 * executable ReviewMaterial proposal.
 */
export function validateReviewMaterialProposalTarget(
  target: Pick<ReviewMaterialTarget, "upload_status" | "review_status" | "updated_at">,
): ReviewMaterialValidationResult<ValidatedTargetVersion> {
  if (target.upload_status !== "uploaded") {
    return invalid(
      "MATERIAL_NOT_UPLOADED",
      "업로드가 완료된 자료만 검토 상태 변경 제안을 만들 수 있습니다.",
    );
  }
  if (target.review_status !== "pending") {
    return invalid(
      "MATERIAL_NOT_PENDING",
      "review_status가 pending인 자료만 검토 상태 변경 제안을 만들 수 있습니다.",
    );
  }

  const targetVersion = canonicalizeTargetVersion(target.updated_at);
  if (!targetVersion.ok) return targetVersion;
  return { ok: true, data: { targetVersion: targetVersion.data } };
}

/**
 * Execution-time validation. The caller must reload the material before using
 * this result; the helper only compares the reloaded state with the proposal's
 * observed version and never authorizes a database mutation.
 */
export function validateReviewMaterialTransition(input: {
  current: Pick<ReviewMaterialTarget, "upload_status" | "review_status" | "updated_at">;
  expectedTargetVersion: string;
}): ReviewMaterialValidationResult<{
  from: typeof REVIEW_MATERIAL_ACTION.fromReviewStatus;
  to: typeof REVIEW_MATERIAL_ACTION.toReviewStatus;
  targetVersion: string;
}> {
  const target = validateReviewMaterialProposalTarget(input.current);
  if (!target.ok) return target;

  const expectedVersion = canonicalizeTargetVersion(input.expectedTargetVersion);
  if (!expectedVersion.ok) return expectedVersion;
  if (target.data.targetVersion !== expectedVersion.data) {
    return invalid(
      "STALE_TARGET_VERSION",
      "자료가 제안 생성 이후 변경되어 다시 확인해야 합니다.",
    );
  }

  return {
    ok: true,
    data: {
      from: REVIEW_MATERIAL_ACTION.fromReviewStatus,
      to: REVIEW_MATERIAL_ACTION.toReviewStatus,
      targetVersion: target.data.targetVersion,
    },
  };
}

/**
 * Converts the already permission-filtered pending-material task into the
 * bounded evidence snapshot persisted with a proposal. The material state is
 * validated separately because task evidence is explanatory, not authority.
 */
export function buildReviewMaterialProposalEvidence(input: {
  task: AdminCopilotTask;
  materialId: UUID;
  courseId: UUID;
}): ReviewMaterialValidationResult<ReviewMaterialProposalEvidence> {
  const { task } = input;
  if (task.type !== REVIEW_MATERIAL_ACTION.sourceSignalType) {
    return invalid(
      "INVALID_SOURCE_TASK",
      "ReviewMaterial 제안의 source task가 pending_material_review가 아닙니다.",
    );
  }

  const materialEvidence = task.evidence.find(
    (evidence) =>
      evidence.entityType === "material" && evidence.entityId === input.materialId,
  );
  const courseEvidence = task.evidence.find(
    (evidence) =>
      evidence.entityType === "course" && evidence.entityId === input.courseId,
  );
  if (!materialEvidence || !courseEvidence) {
    return invalid(
      "INVALID_SOURCE_TASK",
      "source task에 대상 자료와 소속 수업 evidence가 모두 필요합니다.",
    );
  }

  return {
    ok: true,
    data: {
      taskId: task.id,
      taskType: task.type,
      title: task.title,
      summary: task.summary,
      relatedHref: task.relatedHref,
      recommendedManualAction: task.recommendedManualAction,
      evidence: [copyEvidence(materialEvidence), copyEvidence(courseEvidence)],
    },
  };
}

/**
 * Builds the complete DB-shaped proposal payload without reading or writing
 * any external state. A failed result must not be persisted by the caller.
 */
export function buildReviewMaterialProposal(input: {
  workspaceId: UUID;
  material: ReviewMaterialTarget;
  sourceTask: AdminCopilotTask;
}): ReviewMaterialValidationResult<ReviewMaterialProposalContract> {
  const target = validateReviewMaterialProposalTarget(input.material);
  if (!target.ok) return target;

  const fingerprint = buildReviewMaterialSourceFingerprint({
    workspaceId: input.workspaceId,
    materialId: input.material.id,
    targetUpdatedAt: target.data.targetVersion,
  });
  if (!fingerprint.ok) return fingerprint;

  const evidence = buildReviewMaterialProposalEvidence({
    task: input.sourceTask,
    materialId: input.material.id,
    courseId: input.material.course_id,
  });
  if (!evidence.ok) return evidence;

  return {
    ok: true,
    data: {
      source_signal_type: REVIEW_MATERIAL_ACTION.sourceSignalType,
      source_fingerprint: fingerprint.data,
      action_type: REVIEW_MATERIAL_ACTION.actionType,
      action_version: REVIEW_MATERIAL_ACTION.actionVersion,
      target_type: REVIEW_MATERIAL_ACTION.targetType,
      target_id: input.material.id,
      target_version: target.data.targetVersion,
      parameters: { reviewStatus: REVIEW_MATERIAL_ACTION.toReviewStatus },
      evidence: evidence.data,
      proposed_by_kind: REVIEW_MATERIAL_ACTION.proposedByKind,
    },
  };
}

function copyEvidence(evidence: AdminCopilotEvidence): AdminCopilotEvidence {
  return {
    ...evidence,
    ...(evidence.metadata ? { metadata: { ...evidence.metadata } } : {}),
  };
}

function invalid(
  code: ReviewMaterialValidationCode,
  message: string,
): ReviewMaterialValidationFailure {
  return { ok: false, code, message };
}
