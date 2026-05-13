create extension if not exists "pgcrypto";
create extension if not exists "citext";

create type public.workspace_role as enum ('owner_admin', 'group_admin', 'instructor');
create type public.member_status as enum ('active', 'invited', 'disabled', 'removed');
create type public.group_status as enum ('active', 'inactive');
create type public.participant_status as enum ('active', 'inactive', 'deleted');
create type public.participant_group_status as enum ('active', 'removed');
create type public.course_participant_status as enum ('active', 'excluded');
create type public.course_status as enum ('planned', 'in_progress', 'completed');
create type public.session_type as enum ('regular', 'makeup', 'special', 'practice');
create type public.session_visibility_status as enum ('visible', 'hidden');
create type public.session_rollup_status as enum ('included', 'excluded');
create type public.session_progress_status as enum ('scheduled', 'cancelled');
create type public.material_upload_status as enum ('uploading', 'uploaded', 'failed');
create type public.material_review_status as enum ('pending', 'reviewed');
create type public.attendance_status as enum ('present', 'partial', 'absent');
create type public.material_visibility_scope as enum ('all_course_groups', 'selected_groups');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  timezone text not null default 'Asia/Seoul',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email citext not null,
  display_name text,
  role public.workspace_role not null,
  status public.member_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email),
  unique (workspace_id, user_id)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  status public.group_status not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.workspace_member_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  group_id uuid not null,
  created_at timestamptz not null default now(),
  unique (member_id, group_id),
  foreign key (workspace_id, group_id) references public.groups(workspace_id, id) on delete cascade
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  memo text,
  status public.participant_status not null default 'active',
  created_by uuid references public.workspace_members(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.participant_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  participant_id uuid not null,
  group_id uuid not null,
  status public.participant_group_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, group_id),
  foreign key (workspace_id, participant_id) references public.participants(workspace_id, id) on delete cascade,
  foreign key (workspace_id, group_id) references public.groups(workspace_id, id) on delete cascade
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  status public.course_status not null default 'planned',
  starts_on date,
  ends_on date,
  instructor_member_id uuid references public.workspace_members(id) on delete set null,
  card_color text,
  banner_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.course_recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_id uuid not null unique,
  repeat_weekdays smallint[] not null,
  starts_at time not null,
  ends_at time not null,
  ends_on date,
  session_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, course_id) references public.courses(workspace_id, id) on delete cascade,
  check (array_length(repeat_weekdays, 1) >= 1),
  check (repeat_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  check (ends_at > starts_at),
  check ((ends_on is null) <> (session_count is null)),
  check (session_count is null or session_count > 0)
);

create table public.course_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_id uuid not null,
  group_id uuid not null,
  group_name_snapshot text not null,
  created_at timestamptz not null default now(),
  unique (course_id, group_id),
  foreign key (workspace_id, course_id) references public.courses(workspace_id, id) on delete cascade,
  foreign key (workspace_id, group_id) references public.groups(workspace_id, id) on delete restrict
);

create table public.course_participants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_id uuid not null,
  participant_id uuid not null,
  status public.course_participant_status not null default 'active',
  participant_name_snapshot text not null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (course_id, participant_id),
  foreign key (workspace_id, course_id) references public.courses(workspace_id, id) on delete cascade,
  foreign key (workspace_id, participant_id) references public.participants(workspace_id, id) on delete restrict
);

create table public.course_participant_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_participant_id uuid not null,
  group_id uuid not null,
  group_name_snapshot text not null,
  created_at timestamptz not null default now(),
  unique (course_participant_id, group_id),
  foreign key (workspace_id, course_participant_id) references public.course_participants(workspace_id, id) on delete cascade,
  foreign key (workspace_id, group_id) references public.groups(workspace_id, id) on delete restrict
);

create table public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_id uuid not null,
  session_no integer not null check (session_no > 0),
  date date not null,
  starts_at time not null,
  ends_at time not null,
  type public.session_type not null default 'regular',
  visibility_status public.session_visibility_status not null default 'visible',
  rollup_status public.session_rollup_status not null default 'included',
  progress_status public.session_progress_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (course_id, session_no),
  foreign key (workspace_id, course_id) references public.courses(workspace_id, id) on delete cascade,
  check (ends_at > starts_at)
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_id uuid not null,
  title text not null check (length(trim(title)) > 0),
  description text,
  storage_path text,
  original_filename text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 52428800),
  uploaded_by uuid references public.workspace_members(id) on delete set null,
  upload_status public.material_upload_status not null default 'uploading',
  review_status public.material_review_status not null default 'pending',
  visibility_scope public.material_visibility_scope not null default 'all_course_groups',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, course_id) references public.courses(workspace_id, id) on delete cascade
);

create table public.material_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  material_id uuid not null,
  group_id uuid not null,
  created_at timestamptz not null default now(),
  unique (material_id, group_id),
  foreign key (workspace_id, material_id) references public.materials(workspace_id, id) on delete cascade,
  foreign key (workspace_id, group_id) references public.groups(workspace_id, id) on delete restrict
);

create table public.general_schedule_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  date date not null,
  starts_at time,
  ends_at time,
  description text,
  color text,
  created_by uuid references public.workspace_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.general_schedule_item_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  schedule_item_id uuid not null,
  group_id uuid not null,
  created_at timestamptz not null default now(),
  unique (schedule_item_id, group_id),
  foreign key (workspace_id, schedule_item_id) references public.general_schedule_items(workspace_id, id) on delete cascade,
  foreign key (workspace_id, group_id) references public.groups(workspace_id, id) on delete cascade
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  session_id uuid not null,
  participant_id uuid not null,
  participant_name_snapshot text not null,
  status public.attendance_status not null,
  note text,
  updated_by uuid references public.workspace_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, participant_id),
  foreign key (workspace_id, session_id) references public.course_sessions(workspace_id, id) on delete cascade,
  foreign key (workspace_id, participant_id) references public.participants(workspace_id, id) on delete restrict
);

create table public.class_memos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  session_id uuid not null,
  content text not null default '',
  updated_by uuid references public.workspace_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id),
  foreign key (workspace_id, session_id) references public.course_sessions(workspace_id, id) on delete cascade
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  token_hash text not null unique,
  role public.workspace_role not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references public.workspace_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.invite_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invite_id uuid not null,
  group_id uuid not null,
  created_at timestamptz not null default now(),
  unique (invite_id, group_id),
  foreign key (workspace_id, invite_id) references public.invites(workspace_id, id) on delete cascade,
  foreign key (workspace_id, group_id) references public.groups(workspace_id, id) on delete cascade
);

create table public.invite_courses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invite_id uuid not null,
  course_id uuid not null,
  created_at timestamptz not null default now(),
  unique (invite_id, course_id),
  foreign key (workspace_id, invite_id) references public.invites(workspace_id, id) on delete cascade,
  foreign key (workspace_id, course_id) references public.courses(workspace_id, id) on delete cascade
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_member_id uuid references public.workspace_members(id) on delete set null,
  event_type text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index workspace_members_workspace_role_status_idx on public.workspace_members(workspace_id, role, status);
create index workspace_member_groups_group_id_idx on public.workspace_member_groups(group_id);
create index groups_workspace_status_idx on public.groups(workspace_id, status) where deleted_at is null;
create index participant_groups_group_id_idx on public.participant_groups(group_id);
create index courses_workspace_status_idx on public.courses(workspace_id, status);
create index courses_instructor_member_id_idx on public.courses(instructor_member_id);
create index course_groups_group_id_idx on public.course_groups(group_id);
create index course_participants_participant_id_idx on public.course_participants(participant_id);
create index course_sessions_course_date_idx on public.course_sessions(course_id, date, starts_at);
create index materials_course_id_idx on public.materials(course_id);
create index attendance_records_session_id_idx on public.attendance_records(session_id);
create index activity_logs_workspace_created_at_idx on public.activity_logs(workspace_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger set_workspace_members_updated_at before update on public.workspace_members for each row execute function public.set_updated_at();
create trigger set_groups_updated_at before update on public.groups for each row execute function public.set_updated_at();
create trigger set_participants_updated_at before update on public.participants for each row execute function public.set_updated_at();
create trigger set_participant_groups_updated_at before update on public.participant_groups for each row execute function public.set_updated_at();
create trigger set_courses_updated_at before update on public.courses for each row execute function public.set_updated_at();
create trigger set_course_recurrence_rules_updated_at before update on public.course_recurrence_rules for each row execute function public.set_updated_at();
create trigger set_course_participants_updated_at before update on public.course_participants for each row execute function public.set_updated_at();
create trigger set_course_sessions_updated_at before update on public.course_sessions for each row execute function public.set_updated_at();
create trigger set_materials_updated_at before update on public.materials for each row execute function public.set_updated_at();
create trigger set_general_schedule_items_updated_at before update on public.general_schedule_items for each row execute function public.set_updated_at();
create trigger set_attendance_records_updated_at before update on public.attendance_records for each row execute function public.set_updated_at();
create trigger set_class_memos_updated_at before update on public.class_memos for each row execute function public.set_updated_at();
create trigger set_invites_updated_at before update on public.invites for each row execute function public.set_updated_at();

create function public.current_member_id(target_workspace_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.workspace_members
  where workspace_id = target_workspace_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1
$$;

create function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role = 'owner_admin'
      and status = 'active'
  )
$$;

create function public.accessible_group_ids(target_workspace_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id
  from public.groups g
  where g.workspace_id = target_workspace_id
    and g.deleted_at is null
    and public.is_workspace_owner(target_workspace_id)
  union
  select wmg.group_id
  from public.workspace_member_groups wmg
  join public.workspace_members wm on wm.id = wmg.member_id
  where wmg.workspace_id = target_workspace_id
    and wm.user_id = auth.uid()
    and wm.role = 'group_admin'
    and wm.status = 'active'
$$;

create function public.can_access_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = target_group_id
      and (
        public.is_workspace_owner(g.workspace_id)
        or g.id in (select public.accessible_group_ids(g.workspace_id))
      )
  )
$$;

create function public.can_access_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses c
    left join public.workspace_members wm
      on wm.id = c.instructor_member_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role = 'instructor'
    where c.id = target_course_id
      and (
        public.is_workspace_owner(c.workspace_id)
        or wm.id is not null
        or exists (
          select 1
          from public.course_groups cg
          where cg.course_id = c.id
            and cg.group_id in (select public.accessible_group_ids(c.workspace_id))
        )
      )
  )
$$;

create function public.can_manage_full_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses c
    where c.id = target_course_id
      and (
        public.is_workspace_owner(c.workspace_id)
        or (
          exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id = c.workspace_id
              and wm.user_id = auth.uid()
              and wm.role = 'group_admin'
              and wm.status = 'active'
          )
          and not exists (
            select 1
            from public.course_groups cg
            where cg.course_id = c.id
              and cg.group_id not in (select public.accessible_group_ids(c.workspace_id))
          )
        )
      )
  )
$$;

create function public.can_access_session(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.course_sessions cs
    where cs.id = target_session_id
      and public.can_access_course(cs.course_id)
  )
$$;

create function public.can_access_material(target_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.materials m
    join public.courses c on c.id = m.course_id
    left join public.workspace_members instructor
      on instructor.id = c.instructor_member_id
      and instructor.user_id = auth.uid()
      and instructor.status = 'active'
      and instructor.role = 'instructor'
    where m.id = target_material_id
      and (
        public.is_workspace_owner(m.workspace_id)
        or instructor.id is not null
        or (
          m.visibility_scope = 'all_course_groups'
          and exists (
            select 1
            from public.course_groups cg
            where cg.course_id = m.course_id
              and cg.group_id in (select public.accessible_group_ids(m.workspace_id))
          )
        )
        or (
          m.visibility_scope = 'selected_groups'
          and exists (
            select 1
            from public.material_groups mg
            where mg.material_id = m.id
              and mg.group_id in (select public.accessible_group_ids(m.workspace_id))
          )
        )
      )
  )
$$;

create function public.create_workspace(workspace_name text, workspace_timezone text default 'Asia/Seoul')
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace public.workspaces;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select email into current_email from auth.users where id = auth.uid();

  insert into public.workspaces (name, timezone, created_by)
  values (workspace_name, coalesce(nullif(workspace_timezone, ''), 'Asia/Seoul'), auth.uid())
  returning * into new_workspace;

  insert into public.workspace_members (workspace_id, user_id, email, display_name, role, status)
  values (
    new_workspace.id,
    auth.uid(),
    coalesce(current_email, auth.uid()::text),
    split_part(coalesce(current_email, ''), '@', 1),
    'owner_admin',
    'active'
  );

  return new_workspace;
end;
$$;

create function public.prevent_last_owner_change()
returns trigger
language plpgsql
as $$
declare
  active_owner_count integer;
begin
  if old.role = 'owner_admin' and old.status = 'active'
    and (tg_op = 'DELETE' or new.role <> 'owner_admin' or new.status <> 'active')
  then
    select count(*) into active_owner_count
    from public.workspace_members
    where workspace_id = old.workspace_id
      and role = 'owner_admin'
      and status = 'active'
      and id <> old.id;

    if active_owner_count = 0 then
      raise exception 'Cannot remove or demote the last active owner admin';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger prevent_last_owner_update before update on public.workspace_members for each row execute function public.prevent_last_owner_change();
create trigger prevent_last_owner_delete before delete on public.workspace_members for each row execute function public.prevent_last_owner_change();

create function public.ensure_course_participant_group_is_course_group()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.course_participants cp
    join public.course_groups cg on cg.course_id = cp.course_id and cg.group_id = new.group_id
    where cp.id = new.course_participant_id
      and cp.workspace_id = new.workspace_id
  ) then
    raise exception 'course_participant_groups.group_id must be connected to the course';
  end if;
  return new;
end;
$$;

create trigger ensure_course_participant_group_is_course_group
before insert or update on public.course_participant_groups
for each row execute function public.ensure_course_participant_group_is_course_group();

create function public.ensure_material_group_is_course_group()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.materials m
    join public.course_groups cg on cg.course_id = m.course_id and cg.group_id = new.group_id
    where m.id = new.material_id
      and m.workspace_id = new.workspace_id
  ) then
    raise exception 'material_groups.group_id must be connected to the material course';
  end if;
  return new;
end;
$$;

create trigger ensure_material_group_is_course_group
before insert or update on public.material_groups
for each row execute function public.ensure_material_group_is_course_group();

create function public.reset_material_review_status()
returns trigger
language plpgsql
as $$
begin
  if new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.storage_path is distinct from old.storage_path
    or new.original_filename is distinct from old.original_filename
    or new.visibility_scope is distinct from old.visibility_scope
  then
    new.review_status = 'pending';
  end if;
  return new;
end;
$$;

create trigger reset_material_review_status
before update on public.materials
for each row execute function public.reset_material_review_status();

create function public.reset_material_review_status_after_group_change()
returns trigger
language plpgsql
as $$
declare
  target_material_id uuid;
begin
  target_material_id = coalesce(new.material_id, old.material_id);

  update public.materials
  set review_status = 'pending'
  where id = target_material_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger reset_material_review_status_after_group_insert
after insert on public.material_groups
for each row execute function public.reset_material_review_status_after_group_change();

create trigger reset_material_review_status_after_group_update
after update on public.material_groups
for each row execute function public.reset_material_review_status_after_group_change();

create trigger reset_material_review_status_after_group_delete
after delete on public.material_groups
for each row execute function public.reset_material_review_status_after_group_change();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_member_groups enable row level security;
alter table public.groups enable row level security;
alter table public.participants enable row level security;
alter table public.participant_groups enable row level security;
alter table public.courses enable row level security;
alter table public.course_recurrence_rules enable row level security;
alter table public.course_groups enable row level security;
alter table public.course_participants enable row level security;
alter table public.course_participant_groups enable row level security;
alter table public.course_sessions enable row level security;
alter table public.materials enable row level security;
alter table public.material_groups enable row level security;
alter table public.general_schedule_items enable row level security;
alter table public.general_schedule_item_groups enable row level security;
alter table public.attendance_records enable row level security;
alter table public.class_memos enable row level security;
alter table public.invites enable row level security;
alter table public.invite_groups enable row level security;
alter table public.invite_courses enable row level security;
alter table public.activity_logs enable row level security;

create policy "members can view their workspaces"
on public.workspaces for select
to authenticated
using (public.current_member_id(id) is not null);

create policy "authenticated users can create own workspace"
on public.workspaces for insert
to authenticated
with check (created_by = auth.uid());

create policy "owners can update workspaces"
on public.workspaces for update
to authenticated
using (public.is_workspace_owner(id))
with check (public.is_workspace_owner(id));

create policy "members can view workspace members"
on public.workspace_members for select
to authenticated
using (public.current_member_id(workspace_id) is not null);

create policy "owners can manage workspace members"
on public.workspace_members for all
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "members can view member groups"
on public.workspace_member_groups for select
to authenticated
using (public.current_member_id(workspace_id) is not null);

create policy "owners can manage member groups"
on public.workspace_member_groups for all
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "operators can view accessible groups"
on public.groups for select
to authenticated
using (public.can_access_group(id));

create policy "owners can manage groups"
on public.groups for all
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "operators can view accessible participants"
on public.participants for select
to authenticated
using (
  public.is_workspace_owner(participants.workspace_id)
  or exists (
    select 1
    from public.participant_groups pg
    where pg.participant_id = participants.id
      and pg.status = 'active'
      and pg.group_id in (select public.accessible_group_ids(participants.workspace_id))
  )
  or exists (
    select 1
    from public.course_participants cp
    join public.courses c on c.id = cp.course_id
    where cp.participant_id = participants.id
      and public.can_access_course(c.id)
  )
);

create policy "owners and group admins can manage participants"
on public.participants for all
to authenticated
using (
  public.is_workspace_owner(workspace_id)
  or created_by = public.current_member_id(workspace_id)
)
with check (
  public.is_workspace_owner(workspace_id)
  or created_by = public.current_member_id(workspace_id)
);

create policy "operators can view participant groups"
on public.participant_groups for select
to authenticated
using (
  public.is_workspace_owner(workspace_id)
  or group_id in (select public.accessible_group_ids(workspace_id))
);

create policy "owners and group admins can manage participant groups"
on public.participant_groups for all
to authenticated
using (
  public.is_workspace_owner(workspace_id)
  or group_id in (select public.accessible_group_ids(workspace_id))
)
with check (
  public.is_workspace_owner(workspace_id)
  or group_id in (select public.accessible_group_ids(workspace_id))
);

create policy "members can view accessible courses"
on public.courses for select
to authenticated
using (public.can_access_course(id));

create policy "owners and full-scope group admins can manage courses"
on public.courses for all
to authenticated
using (public.is_workspace_owner(workspace_id) or public.can_manage_full_course(id))
with check (public.is_workspace_owner(workspace_id) or public.current_member_id(workspace_id) is not null);

create policy "members can view accessible recurrence rules"
on public.course_recurrence_rules for select
to authenticated
using (public.can_access_course(course_id));

create policy "course managers can manage recurrence rules"
on public.course_recurrence_rules for all
to authenticated
using (public.can_manage_full_course(course_id))
with check (public.can_manage_full_course(course_id));

create policy "members can view accessible course groups"
on public.course_groups for select
to authenticated
using (public.can_access_course(course_id));

create policy "course managers can manage course groups"
on public.course_groups for all
to authenticated
using (public.can_manage_full_course(course_id))
with check (public.is_workspace_owner(workspace_id) or group_id in (select public.accessible_group_ids(workspace_id)));

create policy "members can view accessible course participants"
on public.course_participants for select
to authenticated
using (public.can_access_course(course_id));

create policy "course managers can manage course participants"
on public.course_participants for all
to authenticated
using (public.can_manage_full_course(course_id))
with check (public.can_manage_full_course(course_id));

create policy "members can view accessible course participant groups"
on public.course_participant_groups for select
to authenticated
using (
  public.is_workspace_owner(workspace_id)
  or group_id in (select public.accessible_group_ids(workspace_id))
  or exists (
    select 1
    from public.course_participants cp
    where cp.id = course_participant_groups.course_participant_id
      and public.can_access_course(cp.course_id)
  )
);

create policy "course managers can manage course participant groups"
on public.course_participant_groups for all
to authenticated
using (
  public.is_workspace_owner(workspace_id)
  or group_id in (select public.accessible_group_ids(workspace_id))
)
with check (
  public.is_workspace_owner(workspace_id)
  or group_id in (select public.accessible_group_ids(workspace_id))
);

create policy "members can view accessible sessions"
on public.course_sessions for select
to authenticated
using (public.can_access_course(course_id));

create policy "course managers can manage sessions"
on public.course_sessions for all
to authenticated
using (public.can_manage_full_course(course_id))
with check (public.can_manage_full_course(course_id));

create policy "members can view accessible materials"
on public.materials for select
to authenticated
using (public.can_access_material(id));

create policy "course members can create materials"
on public.materials for insert
to authenticated
with check (public.can_access_course(course_id) and uploaded_by = public.current_member_id(workspace_id));

create policy "uploaders and managers can update materials"
on public.materials for update
to authenticated
using (public.can_manage_full_course(course_id) or uploaded_by = public.current_member_id(workspace_id))
with check (public.can_manage_full_course(course_id) or uploaded_by = public.current_member_id(workspace_id));

create policy "members can view accessible material groups"
on public.material_groups for select
to authenticated
using (
  public.can_access_material(material_id)
  or group_id in (select public.accessible_group_ids(workspace_id))
);

create policy "course managers can manage material groups"
on public.material_groups for all
to authenticated
using (
  exists (
    select 1
    from public.materials m
    where m.id = material_id
      and public.can_manage_full_course(m.course_id)
  )
)
with check (
  exists (
    select 1
    from public.materials m
    where m.id = material_id
      and public.can_manage_full_course(m.course_id)
  )
);

create policy "operators can view accessible schedule items"
on public.general_schedule_items for select
to authenticated
using (
  public.is_workspace_owner(workspace_id)
  or exists (
    select 1
    from public.general_schedule_item_groups gsig
    where gsig.schedule_item_id = general_schedule_items.id
      and gsig.group_id in (select public.accessible_group_ids(general_schedule_items.workspace_id))
  )
);

create policy "operators can manage schedule items"
on public.general_schedule_items for all
to authenticated
using (public.is_workspace_owner(workspace_id) or created_by = public.current_member_id(workspace_id))
with check (public.is_workspace_owner(workspace_id) or created_by = public.current_member_id(workspace_id));

create policy "operators can view accessible schedule item groups"
on public.general_schedule_item_groups for select
to authenticated
using (
  public.is_workspace_owner(workspace_id)
  or group_id in (select public.accessible_group_ids(workspace_id))
);

create policy "operators can manage schedule item groups"
on public.general_schedule_item_groups for all
to authenticated
using (
  public.is_workspace_owner(workspace_id)
  or group_id in (select public.accessible_group_ids(workspace_id))
)
with check (
  public.is_workspace_owner(workspace_id)
  or group_id in (select public.accessible_group_ids(workspace_id))
);

create policy "members can view accessible attendance records"
on public.attendance_records for select
to authenticated
using (public.can_access_session(session_id));

create policy "course members can manage attendance records"
on public.attendance_records for all
to authenticated
using (public.can_access_session(session_id))
with check (public.can_access_session(session_id) and updated_by = public.current_member_id(workspace_id));

create policy "members can view accessible class memos"
on public.class_memos for select
to authenticated
using (public.can_access_session(session_id));

create policy "course members can manage class memos"
on public.class_memos for all
to authenticated
using (public.can_access_session(session_id))
with check (public.can_access_session(session_id) and updated_by = public.current_member_id(workspace_id));

create policy "owners can view invites"
on public.invites for select
to authenticated
using (public.is_workspace_owner(workspace_id));

create policy "owners can manage invites"
on public.invites for all
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "owners can view invite groups"
on public.invite_groups for select
to authenticated
using (public.is_workspace_owner(workspace_id));

create policy "owners can manage invite groups"
on public.invite_groups for all
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "owners can view invite courses"
on public.invite_courses for select
to authenticated
using (public.is_workspace_owner(workspace_id));

create policy "owners can manage invite courses"
on public.invite_courses for all
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "owners can view activity logs"
on public.activity_logs for select
to authenticated
using (public.is_workspace_owner(workspace_id));

create policy "members can insert activity logs"
on public.activity_logs for insert
to authenticated
with check (public.current_member_id(workspace_id) is not null);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials',
  'course-materials',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'text/plain',
    'application/zip'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "course members can read material objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = 'workspaces'
  and (storage.foldername(name))[3] = 'courses'
  and (storage.foldername(name))[5] = 'materials'
  and public.can_access_material(((storage.foldername(name))[6])::uuid)
);

create policy "course members can upload material objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = 'workspaces'
  and (storage.foldername(name))[3] = 'courses'
  and (storage.foldername(name))[5] = 'materials'
  and public.can_access_material(((storage.foldername(name))[6])::uuid)
);

create policy "course members can update material objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = 'workspaces'
  and (storage.foldername(name))[3] = 'courses'
  and (storage.foldername(name))[5] = 'materials'
  and public.can_access_material(((storage.foldername(name))[6])::uuid)
)
with check (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = 'workspaces'
  and (storage.foldername(name))[3] = 'courses'
  and (storage.foldername(name))[5] = 'materials'
  and public.can_access_material(((storage.foldername(name))[6])::uuid)
);
