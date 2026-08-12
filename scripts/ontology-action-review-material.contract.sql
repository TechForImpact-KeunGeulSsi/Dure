-- Run after `supabase db reset` with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/ontology-action-review-material.contract.sql
-- This is a catalog/policy/RPC boundary smoke check. Fixture writes are
-- transactional and roll back at the end of the script.
-- Required functions: public.approve_review_material_proposal and
-- public.reject_review_material_proposal.
begin;

do $$
declare
  proposal_policy_count integer;
  execution_policy_count integer;
begin
  if to_regclass('public.ontology_action_proposals') is null then
    raise exception 'ontology_action_proposals is missing';
  end if;
  if to_regclass('public.ontology_action_executions') is null then
    raise exception 'ontology_action_executions is missing';
  end if;
  if not exists (
    select 1 from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'ontology_action_proposal_status'
  ) then
    raise exception 'proposal status enum is missing';
  end if;
  if not exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'approve_review_material_proposal'
  ) then
    raise exception 'public.approve_review_material_proposal is missing';
  end if;
  if not exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reject_review_material_proposal'
  ) then
    raise exception 'public.reject_review_material_proposal is missing';
  end if;

  select count(*) into proposal_policy_count
  from pg_policies
  where schemaname = 'public' and tablename = 'ontology_action_proposals'
    and cmd = 'SELECT';
  if proposal_policy_count <> 1 then
    raise exception 'expected one proposal SELECT policy, found %', proposal_policy_count;
  end if;

  select count(*) into execution_policy_count
  from pg_policies
  where schemaname = 'public' and tablename = 'ontology_action_executions'
    and cmd = 'SELECT';
  if execution_policy_count <> 1 then
    raise exception 'expected one execution SELECT policy, found %', execution_policy_count;
  end if;
end;
$$;

-- Exercise the two service-role RPCs against a minimal tenant fixture.
do $$
declare
  owner_user_id uuid := '10000000-0000-0000-0000-000000000001';
  non_owner_user_id uuid := '10000000-0000-0000-0000-000000000002';
  workspace_id uuid := '20000000-0000-0000-0000-000000000001';
  owner_member_id uuid := '30000000-0000-0000-0000-000000000001';
  non_owner_member_id uuid := '30000000-0000-0000-0000-000000000002';
  course_id uuid := '40000000-0000-0000-0000-000000000001';
  approve_material_id uuid := '50000000-0000-0000-0000-000000000001';
  approve_proposal_id uuid := '60000000-0000-0000-0000-000000000001';
  reject_material_id uuid := '50000000-0000-0000-0000-000000000002';
  reject_proposal_id uuid := '60000000-0000-0000-0000-000000000002';
  stale_material_id uuid := '50000000-0000-0000-0000-000000000003';
  stale_proposal_id uuid := '60000000-0000-0000-0000-000000000003';
  target_version timestamptz;
  result jsonb;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
  values
    (owner_user_id, 'authenticated', 'authenticated', 'ontology-contract-owner@example.test', 'x', now(), now()),
    (non_owner_user_id, 'authenticated', 'authenticated', 'ontology-contract-member@example.test', 'x', now(), now());

  insert into public.workspaces (id, name, created_by)
  values (workspace_id, 'Ontology Contract Workspace', owner_user_id);
  insert into public.workspace_members (id, workspace_id, user_id, email, role, status)
  values
    (owner_member_id, workspace_id, owner_user_id, 'ontology-contract-owner@example.test', 'owner_admin', 'active'),
    (non_owner_member_id, workspace_id, non_owner_user_id, 'ontology-contract-member@example.test', 'instructor', 'active');
  insert into public.courses (id, workspace_id, name)
  values (course_id, workspace_id, 'Ontology Contract Course');
  insert into public.materials (
    id, workspace_id, course_id, title, upload_status, review_status, updated_at
  ) values
    (approve_material_id, workspace_id, course_id, 'Approve fixture', 'uploaded', 'pending', '2026-08-05T00:00:00Z'),
    (reject_material_id, workspace_id, course_id, 'Reject fixture', 'uploaded', 'pending', '2026-08-05T00:00:00Z'),
    (stale_material_id, workspace_id, course_id, 'Stale fixture', 'uploaded', 'pending', '2026-08-05T00:00:00Z');

  select updated_at into target_version
  from public.materials where id = approve_material_id;
  insert into public.ontology_action_proposals (
    id, workspace_id, source_fingerprint, target_id, target_version, parameters, evidence
  ) values (
    approve_proposal_id, workspace_id, 'contract-approve', approve_material_id,
    target_version, '{}'::jsonb, '{"source":"contract"}'::jsonb
  );

  perform set_config('request.jwt.claim.role', 'service_role', true);
  result := public.approve_review_material_proposal(
    workspace_id, approve_proposal_id, owner_member_id, 'contract-approve-key'
  );
  if result->>'result' <> 'succeeded' then
    raise exception 'approval RPC did not succeed: %', result;
  end if;
  if (select review_status::text from public.materials where id = approve_material_id) <> 'reviewed'
     or (select status::text from public.ontology_action_proposals where id = approve_proposal_id) <> 'approved'
     or (select count(*) from public.ontology_action_executions where proposal_id = approve_proposal_id) <> 1 then
    raise exception 'approval did not persist reviewed/approved/one execution state';
  end if;
  if (select before_state->>'review_status' from public.ontology_action_executions where proposal_id = approve_proposal_id) <> 'pending'
     or (select after_state->>'review_status' from public.ontology_action_executions where proposal_id = approve_proposal_id) <> 'reviewed' then
    raise exception 'before/after audit does not capture pending to reviewed';
  end if;

  result := public.approve_review_material_proposal(
    workspace_id, approve_proposal_id, owner_member_id, 'contract-replay-key'
  );
  if result->>'result' <> 'replayed'
     or (select count(*) from public.ontology_action_executions where proposal_id = approve_proposal_id) <> 1 then
    raise exception 'approval replay created a duplicate execution: %', result;
  end if;

  select updated_at into target_version
  from public.materials where id = reject_material_id;
  insert into public.ontology_action_proposals (
    id, workspace_id, source_fingerprint, target_id, target_version, parameters, evidence
  ) values (
    reject_proposal_id, workspace_id, 'contract-reject', reject_material_id,
    target_version, '{}'::jsonb, '{}'::jsonb
  );
  result := public.reject_review_material_proposal(
    workspace_id, reject_proposal_id, owner_member_id, 'not ready'
  );
  if result->>'result' <> 'rejected'
     or (select review_status::text from public.materials where id = reject_material_id) <> 'pending'
     or (select status::text from public.ontology_action_proposals where id = reject_proposal_id) <> 'rejected'
     or (select count(*) from public.ontology_action_executions where proposal_id = reject_proposal_id) <> 0 then
    raise exception 'rejection mutated material or created execution: %', result;
  end if;

  select updated_at into target_version
  from public.materials where id = stale_material_id;
  insert into public.ontology_action_proposals (
    id, workspace_id, source_fingerprint, target_id, target_version, parameters, evidence
  ) values (
    stale_proposal_id, workspace_id, 'contract-stale', stale_material_id,
    target_version, '{}'::jsonb, '{}'::jsonb
  );
  update public.materials set title = 'Stale fixture changed' where id = stale_material_id;
  result := public.approve_review_material_proposal(
    workspace_id, stale_proposal_id, owner_member_id, 'contract-stale-key'
  );
  if result->>'result' <> 'stale_proposal'
     or (select status::text from public.ontology_action_proposals where id = stale_proposal_id) <> 'expired'
     or (select review_status::text from public.materials where id = stale_material_id) <> 'pending'
     or (select count(*) from public.ontology_action_executions where proposal_id = stale_proposal_id) <> 0 then
    raise exception 'stale approval did not expire without mutation: %', result;
  end if;
end;
$$;

-- RLS smoke: the owner sees the tenant ledger; an active non-owner does not.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
do $$
begin
  if (select count(*) from public.ontology_action_proposals
      where workspace_id = '20000000-0000-0000-0000-000000000001') <> 3 then
    raise exception 'owner cannot read all tenant proposals through RLS';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$
begin
  if (select count(*) from public.ontology_action_proposals
      where workspace_id = '20000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'non-owner can read tenant proposals through RLS';
  end if;
end;
$$;

rollback;
