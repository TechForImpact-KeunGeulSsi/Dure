#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

import { buildAdminCopilotBriefing } from "../src/services/admin-copilot-logic.ts";
import { buildReviewMaterialProposal } from "../src/services/ontology-action-contract.ts";
import {
  DEFAULT_DEVELOPER_QA_ACCOUNTS,
  buildDeveloperQaFixture,
  deterministicUuid,
  getSeoulDate,
} from "./developer-qa-fixture.mjs";

const LOCAL_QA_WORKSPACE_ID = "d0000000-0000-4000-8000-000000000001";
const LOCAL_QA_PASSWORD = "dure-local-qa-password";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.reset) {
    throw new Error("This local-only verifier requires --reset to establish a clean fixture.");
  }

  const config = loadLocalConfig(args.referenceDate);
  execFileSync(
    process.execPath,
    [
      "--no-warnings",
      "scripts/seed-developer-qa.mjs",
      "--local",
      "--reset",
      ...(args.referenceDate ? ["--reference-date", args.referenceDate] : []),
    ],
    { cwd: process.cwd(), stdio: "inherit" },
  );

  const admin = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sessions = await signInAll(config);
  const fixture = buildDeveloperQaFixture({
    workspaceId: config.workspaceId,
    referenceDate: config.referenceDate,
  });
  const material = fixture.materials.find((row) => row.key === "pending");
  if (!material) throw new Error("Developer QA pending material fixture is missing.");

  await assertBaseline(admin, sessions.owner.client, config.workspaceId, fixture, material.id);

  const rejectedProposal = await createProposal(admin, fixture, material, "rejected");
  await assertSingleProposal(admin, config.workspaceId, rejectedProposal.source_fingerprint);
  const rejection = await callRpc(admin, "reject_review_material_proposal", {
    p_workspace_id: config.workspaceId,
    p_proposal_id: rejectedProposal.id,
    p_actor_member_id: sessions.owner.memberId,
    p_decision_note: "자료 내용을 다시 확인해야 합니다.",
  });
  assert.equal(rejection.result, "rejected");
  await assertRejectedState(
    admin,
    config.workspaceId,
    material.id,
    rejectedProposal.id,
    sessions.owner.memberId,
  );

  const firstChangedMaterial = await changeMaterial(
    admin,
    config.workspaceId,
    material.id,
    "Task 7 stale version 1",
  );
  const staleProposal = await createProposal(admin, fixture, firstChangedMaterial, "stale");
  const secondChangedMaterial = await changeMaterial(
    admin,
    config.workspaceId,
    material.id,
    "Task 7 stale version 2",
  );
  assert.notEqual(firstChangedMaterial.updated_at, secondChangedMaterial.updated_at);
  const staleApproval = await callRpc(admin, "approve_review_material_proposal", {
    p_workspace_id: config.workspaceId,
    p_proposal_id: staleProposal.id,
    p_actor_member_id: sessions.owner.memberId,
    p_idempotency_key: `task7-stale-${staleProposal.id}`,
  });
  assert.equal(staleApproval.result, "stale_proposal");
  await assertExpiredState(admin, config.workspaceId, material.id, staleProposal.id);

  const freshMaterial = await loadMaterial(admin, config.workspaceId, material.id);
  const freshProposal = await createProposal(admin, fixture, freshMaterial, "approved");
  const idempotencyKey = `task7-approve-${freshProposal.id}`;
  const approval = await callRpc(admin, "approve_review_material_proposal", {
    p_workspace_id: config.workspaceId,
    p_proposal_id: freshProposal.id,
    p_actor_member_id: sessions.owner.memberId,
    p_idempotency_key: idempotencyKey,
  });
  assert.equal(approval.result, "succeeded");
  const replay = await callRpc(admin, "approve_review_material_proposal", {
    p_workspace_id: config.workspaceId,
    p_proposal_id: freshProposal.id,
    p_actor_member_id: sessions.owner.memberId,
    p_idempotency_key: idempotencyKey,
  });
  assert.equal(replay.result, "replayed");
  await assertApprovedState(
    admin,
    config.workspaceId,
    material.id,
    freshProposal.id,
    sessions.owner.memberId,
    idempotencyKey,
    fixture,
  );

  await assertNonOwnerLedgerAccess(sessions, config.workspaceId);

  console.log("ReviewMaterial local DB/Auth E2E state verification passed.");
  console.log(JSON.stringify({
    workspaceId: config.workspaceId,
    rejectedProposalId: rejectedProposal.id,
    expiredProposalId: staleProposal.id,
    approvedProposalId: freshProposal.id,
    executionId: approval.execution_id,
    ownerRole: sessions.owner.role,
    nonOwnerRoles: [sessions.groupAdmin.role, sessions.instructor.role],
    browserRequired: "Run the owner/group-admin/instructor browser checklist against the same local fixture.",
  }, null, 2));
}

main().catch((error) => {
  console.error("ReviewMaterial local E2E verifier failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

function parseArgs(rawArgs) {
  const options = { reset: false, referenceDate: undefined };
  for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index];
    if (value === "--reset") options.reset = true;
    else if (value === "--reference-date") {
      options.referenceDate = rawArgs[index + 1];
      if (!options.referenceDate) throw new Error("--reference-date requires YYYY-MM-DD.");
      index += 1;
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
  }
  return options;
}

function loadLocalConfig(referenceDateOverride) {
  let output;
  try {
    output = execFileSync("supabase", ["status", "-o", "json"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("Local Supabase is not running. Start Docker, run 'supabase start', and retry.");
  }
  let status;
  try {
    status = JSON.parse(output);
  } catch {
    throw new Error("Could not parse 'supabase status -o json' output.");
  }
  const supabaseUrl = status.API_URL ?? status.api_url;
  const anonKey = status.ANON_KEY ?? status.anon_key;
  const serviceRoleKey = status.SERVICE_ROLE_KEY ?? status.service_role_key;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Local Supabase Auth/API services are not ready. Run 'supabase start' and retry.");
  }
  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    workspaceId: LOCAL_QA_WORKSPACE_ID,
    password: LOCAL_QA_PASSWORD,
    referenceDate: referenceDateOverride || getSeoulDate(),
  };
}

async function signInAll(config) {
  const sessions = {};
  for (const [key, account] of Object.entries(DEFAULT_DEVELOPER_QA_ACCOUNTS)) {
    const client = createClient(config.supabaseUrl, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: account.email,
      password: config.password,
    });
    if (error || !data.user) throw new Error(`Auth sign-in failed for ${account.role}: ${error?.message}`);
    const { data: membership, error: membershipError } = await client
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", config.workspaceId)
      .eq("user_id", data.user.id)
      .single();
    if (membershipError) throw new Error(`Membership lookup failed for ${account.role}: ${membershipError.message}`);
    sessions[key] = { client, user: data.user, memberId: membership.id, role: membership.role };
  }
  return sessions;
}

async function assertBaseline(admin, ownerClient, workspaceId, fixture, materialId) {
  const [{ count: proposalCount, error: proposalError }, { count: executionCount, error: executionError }] = await Promise.all([
    admin.from("ontology_action_proposals").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    admin.from("ontology_action_executions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);
  if (proposalError) throw proposalError;
  if (executionError) throw executionError;
  assert.equal(proposalCount, 0, "ordinary briefing baseline must not persist proposals");
  assert.equal(executionCount, 0, "ordinary briefing baseline must not persist executions");

  const { data: ownerRows, error: ownerError } = await ownerClient
    .from("ontology_action_proposals")
    .select("id")
    .eq("workspace_id", workspaceId);
  if (ownerError) throw ownerError;
  assert.deepEqual(ownerRows, [], "owner baseline ledger must be empty");

  const pendingTask = buildBriefing(
    fixture,
    [fixture.materials.find((row) => row.id === materialId)],
  ).tasks.find((task) => task.type === "pending_material_review");
  assert.equal(pendingTask?.action?.targetId, materialId, "pending material signal must be visible before action");
  assert.equal(pendingTask?.action?.proposalId, undefined, "ordinary briefing must not create a proposal");
}

async function createProposal(admin, fixture, material, key) {
  const task = buildBriefing(fixture, [material]).tasks.find(
    (candidate) => candidate.type === "pending_material_review",
  );
  if (!task) throw new Error(`Pending material task is missing for ${material.id}.`);
  const contract = buildReviewMaterialProposal({
    workspaceId: fixture.workspace.id,
    material,
    sourceTask: task,
  });
  if (!contract.ok) throw new Error(`Could not build ${key} proposal: ${contract.message}`);
  const { data, error } = await admin
    .from("ontology_action_proposals")
    .insert({
      id: deterministicUuid(fixture.workspace.id, `task7:proposal:${key}:${material.updated_at}`),
      workspace_id: fixture.workspace.id,
      ...contract.data,
    })
    .select("id, source_fingerprint, target_version, status")
    .single();
  if (error) throw new Error(`Could not persist ${key} proposal: ${error.message}`);
  return data;
}

async function assertSingleProposal(admin, workspaceId, fingerprint) {
  const { count, error } = await admin
    .from("ontology_action_proposals")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("source_fingerprint", fingerprint);
  if (error) throw error;
  assert.equal(count, 1, "one source version must have at most one proposal");
}

async function callRpc(admin, functionName, args) {
  const { data, error } = await admin.rpc(functionName, args);
  if (error) throw new Error(`${functionName} failed: ${error.message}`);
  if (!data || typeof data !== "object") throw new Error(`${functionName} returned an invalid result.`);
  return data;
}

async function loadMaterial(admin, workspaceId, materialId) {
  const { data, error } = await admin
    .from("materials")
    .select("id, course_id, title, upload_status, review_status, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("id", materialId)
    .single();
  if (error) throw error;
  return data;
}

async function changeMaterial(admin, workspaceId, materialId, title) {
  const { data, error } = await admin
    .from("materials")
    .update({ title })
    .eq("workspace_id", workspaceId)
    .eq("id", materialId)
    .select("id, course_id, title, upload_status, review_status, created_at, updated_at")
    .single();
  if (error) throw new Error(`Material version update failed: ${error.message}`);
  return data;
}

async function assertRejectedState(admin, workspaceId, materialId, proposalId, ownerMemberId) {
  const proposal = await loadProposal(admin, workspaceId, proposalId);
  assert.equal(proposal.status, "rejected");
  assert.equal(proposal.decided_by_member_id, ownerMemberId);
  const material = await loadMaterial(admin, workspaceId, materialId);
  assert.equal(material.review_status, "pending");
  const { count, error } = await admin
    .from("ontology_action_executions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("proposal_id", proposalId);
  if (error) throw error;
  assert.equal(count, 0, "rejection must not create an execution");
}

async function assertExpiredState(admin, workspaceId, materialId, proposalId) {
  const proposal = await loadProposal(admin, workspaceId, proposalId);
  assert.equal(proposal.status, "expired");
  const material = await loadMaterial(admin, workspaceId, materialId);
  assert.equal(material.review_status, "pending");
  const { count, error } = await admin
    .from("ontology_action_executions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("proposal_id", proposalId);
  if (error) throw error;
  assert.equal(count, 0, "stale approval must not create an execution");
}

async function assertApprovedState(admin, workspaceId, materialId, proposalId, ownerMemberId, idempotencyKey, fixture) {
  const proposal = await loadProposal(admin, workspaceId, proposalId);
  assert.equal(proposal.status, "approved");
  assert.equal(proposal.decided_by_member_id, ownerMemberId);
  const material = await loadMaterial(admin, workspaceId, materialId);
  assert.equal(material.review_status, "reviewed");
  const { data: executions, error } = await admin
    .from("ontology_action_executions")
    .select("id, actor_member_id, idempotency_key, status, before_state, after_state")
    .eq("workspace_id", workspaceId)
    .eq("proposal_id", proposalId);
  if (error) throw error;
  assert.equal(executions?.length, 1, "repeated approval must keep one execution");
  assert.equal(executions[0].actor_member_id, ownerMemberId);
  assert.equal(executions[0].idempotency_key, idempotencyKey);
  assert.equal(executions[0].status, "succeeded");
  assert.equal(executions[0].before_state.review_status, "pending");
  assert.equal(executions[0].after_state.review_status, "reviewed");

  const briefing = buildBriefing(fixture, []).tasks;
  assert.equal(
    briefing.some((task) => task.type === "pending_material_review"),
    false,
    "reviewed material must remove the pending signal",
  );
}

async function loadProposal(admin, workspaceId, proposalId) {
  const { data, error } = await admin
    .from("ontology_action_proposals")
    .select("id, status, decided_by_member_id")
    .eq("workspace_id", workspaceId)
    .eq("id", proposalId)
    .single();
  if (error) throw error;
  return data;
}

async function assertNonOwnerLedgerAccess(sessions, workspaceId) {
  for (const key of ["groupAdmin", "instructor"]) {
    const { data, error } = await sessions[key].client
      .from("ontology_action_proposals")
      .select("id")
      .eq("workspace_id", workspaceId);
    if (error) throw error;
    assert.deepEqual(data, [], `${sessions[key].role} must not read owner action ledger rows`);
  }
}

function buildBriefing(fixture, materials) {
  const activeParticipantCourses = fixture.courseParticipants
    .filter((row) => row.status === "active")
    .map((row) => ({ course_id: row.course_id, participant_id: row.participant_id }));
  return buildAdminCopilotBriefing({
    workspaceId: fixture.workspace.id,
    timezone: fixture.workspace.timezone,
    referenceDate: `${fixture.referenceDate}T12:00:00+09:00`,
    courses: fixture.courses,
    sessions: fixture.sessions,
    materials,
    feedbacks: [],
    attendanceRecords: [],
    activeParticipantCourses,
  });
}
