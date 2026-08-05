import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

function assertIncludesAll(source, values, label) {
  for (const value of values) {
    assert.ok(source.includes(value), `${label} is missing ${value}`);
  }
}

test("ReviewMaterial migration keeps a bounded tenant-scoped ledger", async () => {
  const migration = await read(
    "supabase/migrations/20260805090000_ontology_action_review_material.sql",
  );

  assertIncludesAll(
    migration,
    [
      "create type public.ontology_action_proposal_status",
      "'pending'",
      "'approved'",
      "'rejected'",
      "'expired'",
      "create type public.ontology_action_execution_status",
      "'succeeded'",
      "'failed'",
      "add constraint workspace_members_workspace_id_id_unique unique (workspace_id, id)",
      "create table public.ontology_action_proposals",
      "create table public.ontology_action_executions",
      "foreign key (workspace_id, target_id)",
      "references public.materials(workspace_id, id)",
      "foreign key (workspace_id, proposal_id)",
      "foreign key (workspace_id, actor_member_id)",
      "references public.materials(workspace_id, id) on delete restrict",
      "references public.ontology_action_proposals(workspace_id, id) on delete restrict",
      "unique (workspace_id, source_fingerprint)",
      "ontology_action_proposals_pending_target_version_idx",
      "ontology_action_executions_succeeded_proposal_idx",
      "set_ontology_action_proposals_updated_at",
      "alter table public.ontology_action_proposals enable row level security",
      "alter table public.ontology_action_executions enable row level security",
      "owners can view ontology action proposals",
      "owners can view ontology action executions",
      "revoke all on table public.ontology_action_proposals, public.ontology_action_executions",
      "grant select on table public.ontology_action_proposals, public.ontology_action_executions",
      "grant all on table public.ontology_action_proposals, public.ontology_action_executions",
    ],
    "ledger contract",
  );
});

test("only the service-role RPCs can approve or reject", async () => {
  const migration = await read(
    "supabase/migrations/20260805090000_ontology_action_review_material.sql",
  );

  assertIncludesAll(
    migration,
    [
      "create or replace function public.approve_review_material_proposal",
      "create or replace function public.reject_review_material_proposal",
      "if auth.role() <> 'service_role'",
      "for update;",
      "set review_status = 'reviewed'",
      "set status = 'expired'",
      "set status = 'rejected'",
      "before_state",
      "after_state",
      "revoke all on function public.approve_review_material_proposal",
      "revoke all on function public.reject_review_material_proposal",
      "grant execute on function public.approve_review_material_proposal",
      "grant execute on function public.reject_review_material_proposal",
      "pg_advisory_xact_lock",
    ],
    "RPC contract",
  );
  assert.match(migration, /p_workspace_id uuid,\s+p_proposal_id uuid,\s+p_actor_member_id uuid/);
  assert.match(
    migration,
    /status in \('approved', 'rejected'\)[\s\S]*decided_by_member_id is not null[\s\S]*status in \('pending', 'expired'\)[\s\S]*decided_by_member_id is null/,
  );
});

test("local DB contract SQL checks catalog, policy, and RPC boundaries", async () => {
  const contract = await read("scripts/ontology-action-review-material.contract.sql");
  assertIncludesAll(
    contract,
    [
      "to_regclass('public.ontology_action_proposals')",
      "to_regclass('public.ontology_action_executions')",
      "pg_policies",
      "public.approve_review_material_proposal",
      "public.reject_review_material_proposal",
      "rollback;",
      "insert into auth.users",
      "approval RPC did not succeed",
      "contract-replay-key",
      "rejection mutated material or created execution",
      "stale approval did not expire without mutation",
      "set local role authenticated",
      "non-owner can read tenant proposals through RLS",
    ],
    "local DB contract",
  );
});
