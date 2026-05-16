-- Workspace join request flow (user → owner direction).
--
-- Adds:
--   1) workspace_join_requests table + RLS + indexes + updated_at trigger
--   2) workspaces SELECT policy that lets any authenticated user browse
--      the public discovery list (id, name, timezone). Inner data of each
--      workspace stays gated by per-table RLS as before.

create table public.workspace_join_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email citext not null,
  display_name text,
  desired_role public.workspace_role not null,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'canceled')),
  reject_reason text,
  reviewed_by uuid references public.workspace_members(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A user may have at most one pending request per workspace at a time.
-- Re-requests after rejection/cancel create new rows (history kept).
create unique index workspace_join_requests_pending_unique
  on public.workspace_join_requests(workspace_id, user_id)
  where status = 'pending';

create index workspace_join_requests_workspace_status_idx
  on public.workspace_join_requests(workspace_id, status, created_at desc);

create index workspace_join_requests_user_idx
  on public.workspace_join_requests(user_id, created_at desc);

create trigger set_workspace_join_requests_updated_at
  before update on public.workspace_join_requests
  for each row execute function public.set_updated_at();

alter table public.workspace_join_requests enable row level security;

-- A user can read their own requests.
create policy "users can view their own join requests"
  on public.workspace_join_requests for select
  to authenticated
  using (user_id = auth.uid());

-- Owner_admin can read all requests for their workspace.
create policy "owners can view workspace join requests"
  on public.workspace_join_requests for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- Inserts are made by the requesting user themselves.
create policy "users can create their own join requests"
  on public.workspace_join_requests for insert
  to authenticated
  with check (user_id = auth.uid());

-- Updates (approve/reject by owner, cancel by self) are routed through the
-- service layer using the admin client, so direct RLS UPDATE policies are
-- intentionally omitted here. (Same pattern as invites/materials.)

-- Allow any authenticated user to see the discoverable workspace list.
-- Pairs with the existing "members can view their workspaces" policy — they
-- combine with OR, so members keep their existing access and everyone else
-- can browse names/timezones for the join-request UI.
create policy "authenticated can browse workspaces for discovery"
  on public.workspaces for select
  to authenticated
  using (true);
