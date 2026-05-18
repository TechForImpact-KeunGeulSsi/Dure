-- Allow a removed membership row to remain as history while the same email or
-- auth user is invited again to the same workspace.
alter table public.workspace_members
  drop constraint if exists workspace_members_workspace_id_email_key;

alter table public.workspace_members
  drop constraint if exists workspace_members_workspace_id_user_id_key;

create unique index if not exists workspace_members_workspace_email_active_key
  on public.workspace_members (workspace_id, email)
  where status <> 'removed';

create unique index if not exists workspace_members_workspace_user_active_key
  on public.workspace_members (workspace_id, user_id)
  where user_id is not null and status <> 'removed';
