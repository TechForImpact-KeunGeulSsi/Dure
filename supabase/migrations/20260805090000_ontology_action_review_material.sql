-- Human-approved ReviewMaterial action ledger (Task 1).
-- Browser roles have read-only owner access. Writes are restricted to the
-- service_role-only RPCs below; proposal creation is intentionally deferred to
-- the server service in a later task.

create type public.ontology_action_proposal_status as enum (
  'pending',
  'approved',
  'rejected',
  'expired'
);

create type public.ontology_action_execution_status as enum (
  'succeeded',
  'failed'
);

-- workspace_members has a UUID primary key but no tenant-composite key in the
-- baseline schema. Add the referenced key before declaring audit FKs.
alter table public.workspace_members
  add constraint workspace_members_workspace_id_id_unique unique (workspace_id, id);

create table public.ontology_action_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_signal_type text not null default 'pending_material_review'
    check (source_signal_type = 'pending_material_review'),
  source_fingerprint text not null check (length(trim(source_fingerprint)) > 0),
  action_type text not null default 'review_material'
    check (action_type = 'review_material'),
  action_version integer not null default 1 check (action_version > 0),
  target_type text not null default 'material'
    check (target_type = 'material'),
  target_id uuid not null,
  target_version timestamptz not null,
  parameters jsonb not null default '{}'::jsonb
    check (jsonb_typeof(parameters) = 'object'),
  evidence jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence) = 'object'),
  status public.ontology_action_proposal_status not null default 'pending',
  proposed_by_kind text not null default 'deterministic_rule'
    check (proposed_by_kind = 'deterministic_rule'),
  decided_by_member_id uuid,
  decided_at timestamptz,
  decision_note text check (decision_note is null or length(decision_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, source_fingerprint),
  foreign key (workspace_id, target_id)
    references public.materials(workspace_id, id) on delete restrict,
  foreign key (workspace_id, decided_by_member_id)
    references public.workspace_members(workspace_id, id) on delete restrict,
  check (
    (status in ('approved', 'rejected')
      and decided_by_member_id is not null and decided_at is not null)
    or
    (status in ('pending', 'expired')
      and decided_by_member_id is null and decided_at is null)
  )
);

create table public.ontology_action_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposal_id uuid not null,
  actor_member_id uuid not null,
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  status public.ontology_action_execution_status not null,
  before_state jsonb not null check (jsonb_typeof(before_state) = 'object'),
  after_state jsonb check (after_state is null or jsonb_typeof(after_state) = 'object'),
  error_code text,
  error_message text,
  executed_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, proposal_id)
    references public.ontology_action_proposals(workspace_id, id) on delete restrict,
  foreign key (workspace_id, actor_member_id)
    references public.workspace_members(workspace_id, id) on delete restrict,
  check (
    (status = 'succeeded' and after_state is not null and error_code is null and error_message is null)
    or
    (status = 'failed' and after_state is null and error_code is not null and error_message is not null)
  )
);

create unique index ontology_action_proposals_pending_target_version_idx
  on public.ontology_action_proposals(workspace_id, action_type, target_id, target_version)
  where status = 'pending';

create unique index ontology_action_executions_succeeded_proposal_idx
  on public.ontology_action_executions(workspace_id, proposal_id)
  where status = 'succeeded';

create index ontology_action_proposals_workspace_status_idx
  on public.ontology_action_proposals(workspace_id, status, created_at desc);

create index ontology_action_executions_workspace_proposal_idx
  on public.ontology_action_executions(workspace_id, proposal_id, executed_at desc);

create trigger set_ontology_action_proposals_updated_at
before update on public.ontology_action_proposals
for each row execute function public.set_updated_at();

alter table public.ontology_action_proposals enable row level security;
alter table public.ontology_action_executions enable row level security;

create policy "owners can view ontology action proposals"
on public.ontology_action_proposals for select
to authenticated
using (public.is_workspace_owner(workspace_id));

create policy "owners can view ontology action executions"
on public.ontology_action_executions for select
to authenticated
using (public.is_workspace_owner(workspace_id));

-- Keep the browser surface read-only and make the server boundary explicit.
revoke all on table public.ontology_action_proposals, public.ontology_action_executions
  from anon, authenticated;
grant select on table public.ontology_action_proposals, public.ontology_action_executions
  to authenticated;
grant all on table public.ontology_action_proposals, public.ontology_action_executions
  to service_role;

-- The RPCs are deliberately narrow: they receive only a bounded proposal id,
-- actor id, and idempotency/decision data. They do not accept arbitrary SQL,
-- target columns, or client-provided before/after state.
create or replace function public.approve_review_material_proposal(
  p_workspace_id uuid,
  p_proposal_id uuid,
  p_actor_member_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.ontology_action_proposals%rowtype;
  v_material public.materials%rowtype;
  v_existing_execution public.ontology_action_executions%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_execution_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception using errcode = '22023', message = 'idempotency key is required';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where id = p_actor_member_id and workspace_id = p_workspace_id
      and role = 'owner_admin' and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'active owner_admin membership is required';
  end if;

  -- Serialize requests carrying the same key, including requests for different proposals.
  perform pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text || ':' || trim(p_idempotency_key), 0)
  );
  select * into v_existing_execution
  from public.ontology_action_executions
  where workspace_id = p_workspace_id and idempotency_key = trim(p_idempotency_key)
  limit 1;
  if found then
    return jsonb_build_object(
      'result', 'replayed', 'proposal_id', v_existing_execution.proposal_id,
      'execution_id', v_existing_execution.id, 'execution_status', v_existing_execution.status
    );
  end if;

  select * into v_proposal
  from public.ontology_action_proposals
  where workspace_id = p_workspace_id and id = p_proposal_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;

  select * into v_existing_execution
  from public.ontology_action_executions
  where workspace_id = p_workspace_id and proposal_id = p_proposal_id
    and status = 'succeeded'
  order by executed_at desc
  limit 1;
  if found then
    return jsonb_build_object(
      'result', 'replayed', 'proposal_id', v_existing_execution.proposal_id,
      'execution_id', v_existing_execution.id, 'execution_status', v_existing_execution.status
    );
  end if;
  if v_proposal.status <> 'pending' then
    return jsonb_build_object('result', 'proposal_not_pending', 'proposal_id', v_proposal.id,
      'proposal_status', v_proposal.status);
  end if;

  select * into v_material
  from public.materials
  where workspace_id = p_workspace_id and id = v_proposal.target_id
  for update;
  if not found then
    update public.ontology_action_proposals
    set status = 'expired' where id = v_proposal.id;
    return jsonb_build_object('result', 'stale_proposal', 'proposal_id', v_proposal.id,
      'proposal_status', 'expired');
  end if;

  if v_material.upload_status <> 'uploaded'
     or v_material.review_status <> 'pending'
     or v_material.updated_at <> v_proposal.target_version then
    update public.ontology_action_proposals
    set status = 'expired' where id = v_proposal.id;
    return jsonb_build_object('result', 'stale_proposal', 'proposal_id', v_proposal.id,
      'proposal_status', 'expired');
  end if;

  v_before := to_jsonb(v_material);
  update public.materials as material_row
  set review_status = 'reviewed'
  where material_row.workspace_id = p_workspace_id and material_row.id = v_material.id
  returning to_jsonb(material_row) into v_after;

  update public.ontology_action_proposals
  set status = 'approved', decided_by_member_id = p_actor_member_id, decided_at = now()
  where id = v_proposal.id;

  insert into public.ontology_action_executions (
    workspace_id, proposal_id, actor_member_id, idempotency_key, status,
    before_state, after_state
  ) values (
    p_workspace_id, v_proposal.id, p_actor_member_id, trim(p_idempotency_key), 'succeeded',
    v_before, v_after
  ) returning id into v_execution_id;

  return jsonb_build_object(
    'result', 'succeeded', 'proposal_id', v_proposal.id,
    'execution_id', v_execution_id, 'before_state', v_before, 'after_state', v_after
  );
end;
$$;

create or replace function public.reject_review_material_proposal(
  p_workspace_id uuid,
  p_proposal_id uuid,
  p_actor_member_id uuid,
  p_decision_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.ontology_action_proposals%rowtype;
  v_note text := nullif(trim(p_decision_note), '');
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if v_note is not null and length(v_note) > 2000 then
    raise exception using errcode = '22023', message = 'decision note is too long';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where id = p_actor_member_id and workspace_id = p_workspace_id
      and role = 'owner_admin' and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'active owner_admin membership is required';
  end if;
  select * into v_proposal
  from public.ontology_action_proposals
  where workspace_id = p_workspace_id and id = p_proposal_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'proposal not found';
  end if;
  if v_proposal.status <> 'pending' then
    return jsonb_build_object('result', 'proposal_not_pending', 'proposal_id', v_proposal.id,
      'proposal_status', v_proposal.status);
  end if;
  update public.ontology_action_proposals
  set status = 'rejected', decided_by_member_id = p_actor_member_id,
      decided_at = now(), decision_note = v_note
  where id = v_proposal.id;
  return jsonb_build_object('result', 'rejected', 'proposal_id', v_proposal.id,
    'proposal_status', 'rejected');
end;
$$;

revoke all on function public.approve_review_material_proposal(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.reject_review_material_proposal(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.approve_review_material_proposal(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.reject_review_material_proposal(uuid, uuid, uuid, text)
  to service_role;
