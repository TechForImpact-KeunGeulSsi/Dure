"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { UUID } from "@/lib/api/types";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DecideReviewMaterialProposalSchema,
  type DecideReviewMaterialProposalInput,
  EnsureReviewMaterialProposalSchema,
  type EnsureReviewMaterialProposalInput,
} from "@/lib/validators/ontology-action";
import { loadCurrentMembership } from "@/services/access";

export type { DecideReviewMaterialProposalInput } from "@/lib/validators/ontology-action";
export type { EnsureReviewMaterialProposalInput } from "@/lib/validators/ontology-action";

import {
  buildReviewMaterialProposal,
  canonicalizeTargetVersion,
  REVIEW_MATERIAL_ACTION,
  type ReviewMaterialProposalContract,
  type ReviewMaterialTarget,
} from "./ontology-action-contract";
import {
  getAdminCopilotBriefing,
  type AdminCopilotTask,
} from "./admin-copilot";

type OntologyActionProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

type ReviewMaterialProposalRow = {
  id: UUID;
  workspace_id: UUID;
  source_signal_type: "pending_material_review";
  source_fingerprint: string;
  action_type: "review_material";
  action_version: number;
  target_type: "material";
  target_id: UUID;
  target_version: string;
  parameters: { reviewStatus: "reviewed" };
  evidence: ReviewMaterialProposalContract["evidence"];
  status: OntologyActionProposalStatus;
  proposed_by_kind: "deterministic_rule";
  decided_by_member_id: UUID | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewMaterialProposal = {
  id: UUID;
  workspaceId: UUID;
  sourceSignalType: ReviewMaterialProposalContract["source_signal_type"];
  sourceFingerprint: string;
  actionType: ReviewMaterialProposalContract["action_type"];
  actionVersion: number;
  targetType: ReviewMaterialProposalContract["target_type"];
  targetId: UUID;
  targetVersion: string;
  parameters: ReviewMaterialProposalContract["parameters"];
  evidence: ReviewMaterialProposalContract["evidence"];
  status: OntologyActionProposalStatus;
  proposedByKind: ReviewMaterialProposalContract["proposed_by_kind"];
  decidedByMemberId: UUID | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewMaterialActionState = {
  id: UUID;
  workspaceId: UUID;
  courseId: UUID;
  uploadStatus: ReviewMaterialTarget["upload_status"];
  reviewStatus: ReviewMaterialTarget["review_status"];
  updatedAt: string;
};

export type ReviewMaterialExecution = {
  id: UUID;
  workspaceId: UUID;
  proposalId: UUID;
  actorMemberId: UUID;
  idempotencyKey: string;
  status: "succeeded";
  executedAt: string;
};

export type ReviewMaterialDecisionResult = {
  decision: DecideReviewMaterialProposalInput["decision"];
  outcome: "succeeded" | "replayed" | "rejected";
  proposal: ReviewMaterialProposal;
  material: ReviewMaterialActionState;
  execution: ReviewMaterialExecution | null;
};

const PROPOSAL_SELECT =
  "id, workspace_id, source_signal_type, source_fingerprint, action_type, action_version, target_type, target_id, target_version, parameters, evidence, status, proposed_by_kind, decided_by_member_id, decided_at, decision_note, created_at, updated_at";

/**
 * Persists the deterministic ReviewMaterial proposal only when the owner
 * explicitly requests it. Ordinary briefing reads do not call this service.
 */
export async function ensureReviewMaterialProposal(
  rawInput: EnsureReviewMaterialProposalInput,
): Promise<ApiResult<ReviewMaterialProposal>> {
  const parsed = EnsureReviewMaterialProposalSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }

  await requireUser();
  const membership = await loadCurrentMembership(parsed.data.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role !== "owner_admin") {
    return apiError(
      "ROLE_FORBIDDEN",
      "ReviewMaterial 제안은 대표 운영자만 만들 수 있습니다.",
    );
  }

  const admin = createSupabaseAdminClient();
  const materialResult = await admin
    .from("materials")
    .select("id, course_id, title, upload_status, review_status, created_at, updated_at")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("id", parsed.data.materialId)
    .maybeSingle();

  if (materialResult.error) {
    return apiError("INTERNAL_ERROR", materialResult.error.message);
  }
  if (!materialResult.data) {
    return apiError("NOT_FOUND", "자료를 찾을 수 없습니다.");
  }

  const courseResult = await admin
    .from("courses")
    .select("id")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("id", materialResult.data.course_id)
    .maybeSingle();
  if (courseResult.error) {
    return apiError("INTERNAL_ERROR", courseResult.error.message);
  }
  if (!courseResult.data) {
    return apiError("NOT_FOUND", "자료가 속한 수업을 찾을 수 없습니다.");
  }

  const material = materialResult.data as ReviewMaterialTarget;
  const currentVersion = canonicalizeTargetVersion(material.updated_at);
  const requestedVersion = canonicalizeTargetVersion(parsed.data.targetUpdatedAt);
  if (!currentVersion.ok || !requestedVersion.ok) {
    return apiError(
      "INTERNAL_ERROR",
      "자료의 현재 버전을 확인하지 못했습니다.",
    );
  }
  if (currentVersion.data !== requestedVersion.data) {
    return apiError(
      "CONFLICT",
      "자료가 제안 화면을 연 이후 변경되어 최신 자료를 다시 확인해야 합니다.",
      {
        meta: {
          reason: "STALE_TARGET_VERSION",
          materialId: material.id,
          currentTargetUpdatedAt: currentVersion.data,
        },
      },
    );
  }

  const sourceTaskResult = await loadPendingMaterialTask(
    parsed.data.workspaceId,
    parsed.data.materialId,
  );
  if (!sourceTaskResult.ok) return sourceTaskResult;

  const targetValidation = buildReviewMaterialProposal({
    workspaceId: parsed.data.workspaceId,
    material,
    sourceTask: sourceTaskResult.data,
  });
  if (!targetValidation.ok) {
    return apiError("CONFLICT", targetValidation.message, {
      meta: { reason: targetValidation.code, materialId: material.id },
    });
  }

  const contract = targetValidation.data;
  const existing = await loadProposalByFingerprint(
    admin,
    parsed.data.workspaceId,
    contract.source_fingerprint,
  );
  if (existing.error) return apiError("INTERNAL_ERROR", existing.error);
  if (existing.data) return apiOk(toReviewMaterialProposal(existing.data));

  const { data, error } = await admin
    .from("ontology_action_proposals")
    .insert({
      workspace_id: parsed.data.workspaceId,
      ...contract,
    })
    .select(PROPOSAL_SELECT)
    .single();

  if (error) {
    // Another request may have inserted the same fingerprint after the read.
    // Re-read that canonical row so ensure remains idempotent under a race.
    if (error.code === "23505") {
      const raced = await loadProposalByFingerprint(
        admin,
        parsed.data.workspaceId,
        contract.source_fingerprint,
      );
      if (raced.error) return apiError("INTERNAL_ERROR", raced.error);
      if (raced.data) return apiOk(toReviewMaterialProposal(raced.data));
    }
    return apiError("INTERNAL_ERROR", error.message);
  }
  if (!data) {
    return apiError("INTERNAL_ERROR", "자료 검토 제안을 저장하지 못했습니다.");
  }

  return apiOk(toReviewMaterialProposal(data as ReviewMaterialProposalRow));
}

/**
 * Applies an explicit owner decision to a persisted ReviewMaterial proposal.
 * The database RPC owns the transaction that locks the proposal/material and
 * records the durable decision and execution audit.
 */
export async function decideReviewMaterialProposal(
  rawInput: DecideReviewMaterialProposalInput,
): Promise<ApiResult<ReviewMaterialDecisionResult>> {
  const parsed = DecideReviewMaterialProposalSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }

  await requireUser();
  const membership = await loadCurrentMembership(parsed.data.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }
  if (membership.role !== "owner_admin") {
    return apiError(
      "ROLE_FORBIDDEN",
      "ReviewMaterial 결정은 대표 운영자만 할 수 있습니다.",
    );
  }

  const admin = createSupabaseAdminClient();
  const proposalResult = await loadProposalById(
    admin,
    parsed.data.workspaceId,
    parsed.data.proposalId,
  );
  if (proposalResult.error) {
    return apiError("INTERNAL_ERROR", proposalResult.error);
  }
  if (!proposalResult.data) {
    return apiError("NOT_FOUND", "자료 검토 제안을 찾을 수 없습니다.");
  }

  const proposal = proposalResult.data;
  if (
    proposal.source_signal_type !== REVIEW_MATERIAL_ACTION.sourceSignalType ||
    proposal.action_type !== "review_material" ||
    proposal.action_version !== REVIEW_MATERIAL_ACTION.actionVersion ||
    proposal.target_type !== REVIEW_MATERIAL_ACTION.targetType ||
    proposal.proposed_by_kind !== REVIEW_MATERIAL_ACTION.proposedByKind
  ) {
    return apiError(
      "CONFLICT",
      "지원하지 않는 ReviewMaterial 제안입니다.",
      { meta: { reason: "UNSUPPORTED_PROPOSAL", proposalId: proposal.id } },
    );
  }

  const materialResult = await loadReviewMaterialActionState(
    admin,
    parsed.data.workspaceId,
    proposal.target_id,
  );
  if (materialResult.error) {
    return apiError("INTERNAL_ERROR", materialResult.error);
  }
  if (!materialResult.data) {
    return apiError("NOT_FOUND", "자료를 찾을 수 없습니다.");
  }

  if (parsed.data.decision === "reject") {
    const { data, error } = await admin.rpc(
      "reject_review_material_proposal",
      {
        p_workspace_id: parsed.data.workspaceId,
        p_proposal_id: proposal.id,
        p_actor_member_id: membership.memberId,
        p_decision_note: parsed.data.note ?? null,
      },
    );
    if (error) return mapDecisionRpcError(error, proposal.id);

    const rpcResult = parseDecisionRpcResult(data);
    if (!rpcResult.ok) return apiError("INTERNAL_ERROR", rpcResult.message);
    if (rpcResult.data.result !== "rejected") {
      if (isNonSuccessDecisionResult(rpcResult.data)) {
        return mapNonSuccessDecisionResult(rpcResult.data, proposal.id);
      }
      return apiError("INTERNAL_ERROR", "거절 RPC가 예상하지 못한 결과를 반환했습니다.");
    }

    const decidedProposal = await loadProposalById(
      admin,
      parsed.data.workspaceId,
      proposal.id,
    );
    if (decidedProposal.error) {
      return apiError("INTERNAL_ERROR", decidedProposal.error);
    }
    if (!decidedProposal.data) {
      return apiError("INTERNAL_ERROR", "결정된 제안을 다시 읽지 못했습니다.");
    }
    if (decidedProposal.data.status !== "rejected") {
      return apiError("INTERNAL_ERROR", "거절 결정이 proposal에 반영되지 않았습니다.");
    }

    const currentMaterial = await loadReviewMaterialActionState(
      admin,
      parsed.data.workspaceId,
      proposal.target_id,
    );
    if (currentMaterial.error) {
      return apiError("INTERNAL_ERROR", currentMaterial.error);
    }
    if (!currentMaterial.data) {
      return apiError("INTERNAL_ERROR", "거절된 제안의 자료를 다시 읽지 못했습니다.");
    }

    revalidateReviewMaterialPaths(
      parsed.data.workspaceId,
      currentMaterial.data.courseId,
    );

    return apiOk({
      decision: "reject",
      outcome: "rejected",
      proposal: toReviewMaterialProposal(decidedProposal.data),
      material: currentMaterial.data,
      execution: null,
    });
  }

  const idempotencyKey = buildReviewMaterialIdempotencyKey(
    parsed.data.workspaceId,
    proposal.id,
  );
  const { data, error } = await admin.rpc(
    "approve_review_material_proposal",
    {
      p_workspace_id: parsed.data.workspaceId,
      p_proposal_id: proposal.id,
      p_actor_member_id: membership.memberId,
      p_idempotency_key: idempotencyKey,
    },
  );
  if (error) return mapDecisionRpcError(error, proposal.id);

  const rpcResult = parseDecisionRpcResult(data);
  if (!rpcResult.ok) return apiError("INTERNAL_ERROR", rpcResult.message);
  if (
    rpcResult.data.result !== "succeeded" &&
    rpcResult.data.result !== "replayed"
  ) {
    if (isNonSuccessDecisionResult(rpcResult.data)) {
      return mapNonSuccessDecisionResult(rpcResult.data, proposal.id);
    }
    return apiError("INTERNAL_ERROR", "승인 RPC가 예상하지 못한 결과를 반환했습니다.");
  }

  const executionId = rpcResult.data.execution_id;
  const [decidedProposal, execution, currentMaterial] = await Promise.all([
    loadProposalById(admin, parsed.data.workspaceId, proposal.id),
    loadReviewMaterialExecution(admin, parsed.data.workspaceId, executionId),
    loadReviewMaterialActionState(
      admin,
      parsed.data.workspaceId,
      proposal.target_id,
    ),
  ]);
  const reloadError = [
    decidedProposal.error,
    execution.error,
    currentMaterial.error,
  ].find(Boolean);
  if (reloadError) return apiError("INTERNAL_ERROR", reloadError);
  if (!decidedProposal.data || !execution.data || !currentMaterial.data) {
    return apiError("INTERNAL_ERROR", "ReviewMaterial 실행 결과를 다시 읽지 못했습니다.");
  }
  if (
    decidedProposal.data.status !== "approved" ||
    execution.data.proposalId !== proposal.id ||
    execution.data.actorMemberId !== membership.memberId ||
    execution.data.idempotencyKey !== idempotencyKey
  ) {
    return apiError("INTERNAL_ERROR", "ReviewMaterial 실행 audit이 proposal과 일치하지 않습니다.");
  }
  if (rpcResult.data.result === "succeeded" && currentMaterial.data.reviewStatus !== "reviewed") {
    return apiError(
      "INTERNAL_ERROR",
      "ReviewMaterial 승인 후 자료 상태를 확인하지 못했습니다.",
    );
  }

  revalidateReviewMaterialPaths(
    parsed.data.workspaceId,
    currentMaterial.data.courseId,
  );

  return apiOk({
    decision: "approve",
    outcome: rpcResult.data.result,
    proposal: toReviewMaterialProposal(decidedProposal.data),
    material: currentMaterial.data,
    execution: execution.data,
  });
}

async function loadPendingMaterialTask(
  workspaceId: UUID,
  materialId: UUID,
): Promise<ApiResult<AdminCopilotTask>> {
  const briefing = await getAdminCopilotBriefing({ workspaceId });
  if (!briefing.ok) return briefing;

  const task = briefing.data.tasks.find(
    (candidate) =>
      candidate.type === "pending_material_review" &&
      candidate.id === `pending-material-review:${materialId}`,
  );
  if (!task) {
    return apiError(
      "CONFLICT",
      "현재 자료에 해당하는 Admin Copilot task가 없습니다.",
      { meta: { reason: "SOURCE_TASK_NOT_FOUND", materialId } },
    );
  }
  return apiOk(task);
}

async function loadProposalByFingerprint(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  workspaceId: UUID,
  sourceFingerprint: string,
): Promise<
  { data: ReviewMaterialProposalRow | null; error: string | null }
> {
  const { data, error } = await admin
    .from("ontology_action_proposals")
    .select(PROPOSAL_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("source_fingerprint", sourceFingerprint)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: (data as ReviewMaterialProposalRow | null) ?? null, error: null };
}

async function loadProposalById(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  workspaceId: UUID,
  proposalId: UUID,
): Promise<
  { data: ReviewMaterialProposalRow | null; error: string | null }
> {
  const { data, error } = await admin
    .from("ontology_action_proposals")
    .select(PROPOSAL_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("id", proposalId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: (data as ReviewMaterialProposalRow | null) ?? null, error: null };
}

async function loadReviewMaterialActionState(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  workspaceId: UUID,
  materialId: UUID,
): Promise<
  { data: ReviewMaterialActionState | null; error: string | null }
> {
  const { data, error } = await admin
    .from("materials")
    .select("id, workspace_id, course_id, upload_status, review_status, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("id", materialId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return {
    data: {
      id: data.id,
      workspaceId: data.workspace_id,
      courseId: data.course_id,
      uploadStatus: data.upload_status,
      reviewStatus: data.review_status,
      updatedAt: data.updated_at,
    },
    error: null,
  };
}

async function loadReviewMaterialExecution(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  workspaceId: UUID,
  executionId: UUID,
): Promise<
  { data: ReviewMaterialExecution | null; error: string | null }
> {
  const { data, error } = await admin
    .from("ontology_action_executions")
    .select(
      "id, workspace_id, proposal_id, actor_member_id, idempotency_key, status, executed_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", executionId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  if (data.status !== "succeeded") {
    return { data: null, error: "ReviewMaterial 실행 audit 상태가 유효하지 않습니다." };
  }
  return {
    data: {
      id: data.id,
      workspaceId: data.workspace_id,
      proposalId: data.proposal_id,
      actorMemberId: data.actor_member_id,
      idempotencyKey: data.idempotency_key,
      status: "succeeded",
      executedAt: data.executed_at,
    },
    error: null,
  };
}

function buildReviewMaterialIdempotencyKey(
  workspaceId: UUID,
  proposalId: UUID,
): string {
  return `review_material:${workspaceId}:${proposalId}`;
}

function revalidateReviewMaterialPaths(workspaceId: UUID, courseId: UUID): void {
  revalidatePath(`/workspaces/${workspaceId}/home`);
  revalidatePath(`/workspaces/${workspaceId}/courses/${courseId}/materials`);
}

type NonSuccessDecisionRpcResult = {
  result: "rejected" | "proposal_not_pending" | "stale_proposal";
  proposal_id: UUID;
  proposal_status: OntologyActionProposalStatus;
};

type DecisionRpcResult =
  | {
      result: "succeeded" | "replayed";
      proposal_id: UUID;
      execution_id: UUID;
    }
  | NonSuccessDecisionRpcResult;

function parseDecisionRpcResult(
  value: unknown,
): { ok: true; data: DecisionRpcResult } | { ok: false; message: string } {
  if (!isRecord(value) || typeof value.result !== "string") {
    return { ok: false, message: "ReviewMaterial RPC 결과 형식이 유효하지 않습니다." };
  }
  if (
    (value.result === "succeeded" || value.result === "replayed") &&
    typeof value.proposal_id === "string" &&
    typeof value.execution_id === "string"
  ) {
    return {
      ok: true,
      data: {
        result: value.result,
        proposal_id: value.proposal_id,
        execution_id: value.execution_id,
      },
    };
  }
  if (
    (value.result === "rejected" ||
      value.result === "proposal_not_pending" ||
      value.result === "stale_proposal") &&
    typeof value.proposal_id === "string" &&
    typeof value.proposal_status === "string" &&
    isProposalStatus(value.proposal_status)
  ) {
    return {
      ok: true,
      data: {
        result: value.result,
        proposal_id: value.proposal_id,
        proposal_status: value.proposal_status,
      },
    };
  }
  return { ok: false, message: "ReviewMaterial RPC 결과 형식이 유효하지 않습니다." };
}

function mapNonSuccessDecisionResult(
  result: NonSuccessDecisionRpcResult,
  proposalId: UUID,
): ApiResult<never> {
  if (result.result === "stale_proposal") {
    return apiError(
      "CONFLICT",
      "자료가 제안 생성 이후 변경되어 최신 자료를 다시 확인해야 합니다.",
      {
        meta: {
          reason: "STALE_PROPOSAL",
          proposalId,
          proposalStatus: result.proposal_status,
        },
      },
    );
  }
  return apiError("CONFLICT", "이미 결정된 자료 검토 제안입니다.", {
    meta: {
      reason: "PROPOSAL_NOT_PENDING",
      proposalId,
      proposalStatus: result.proposal_status,
    },
  });
}

function isNonSuccessDecisionResult(
  result: DecisionRpcResult,
): result is NonSuccessDecisionRpcResult {
  return (
    result.result === "rejected" ||
    result.result === "proposal_not_pending" ||
    result.result === "stale_proposal"
  );
}

function mapDecisionRpcError(
  error: { code?: string; message?: string },
  proposalId: UUID,
): ApiResult<never> {
  if (error.code === "P0002") {
    return apiError("NOT_FOUND", "자료 검토 제안을 찾을 수 없습니다.");
  }
  if (error.code === "42501") {
    return apiError("ROLE_FORBIDDEN", "ReviewMaterial 결정 권한이 없습니다.");
  }
  if (error.code === "22023") {
    return apiError("VALIDATION_FAILED", "ReviewMaterial 결정 입력이 유효하지 않습니다.");
  }
  return apiError(
    "INTERNAL_ERROR",
    error.message ?? `ReviewMaterial 결정에 실패했습니다: ${proposalId}`,
  );
}

function isProposalStatus(value: string): value is OntologyActionProposalStatus {
  return (
    value === "pending" ||
    value === "approved" ||
    value === "rejected" ||
    value === "expired"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toReviewMaterialProposal(
  row: ReviewMaterialProposalRow,
): ReviewMaterialProposal {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    sourceSignalType: row.source_signal_type,
    sourceFingerprint: row.source_fingerprint,
    actionType: row.action_type,
    actionVersion: row.action_version,
    targetType: row.target_type,
    targetId: row.target_id,
    targetVersion: row.target_version,
    parameters: row.parameters,
    evidence: row.evidence,
    status: row.status,
    proposedByKind: row.proposed_by_kind,
    decidedByMemberId: row.decided_by_member_id,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function collectFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]),
    ),
  );
}
