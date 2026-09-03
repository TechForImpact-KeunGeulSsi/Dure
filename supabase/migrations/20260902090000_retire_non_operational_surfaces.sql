-- Retire the settlement request capability without deleting historical data.
-- Historical rows and storage objects are retained for records and future policy decisions.

-- The public course catalog and public material download surface are retired.
-- Keep material metadata/files, but remove anonymous object reads.
create or replace function public.reset_material_review_status()
returns trigger
language plpgsql
as $$
begin
  if new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.storage_path is distinct from old.storage_path
    or new.original_filename is distinct from old.original_filename
  then
    new.review_status = 'pending';
  end if;
  return new;
end;
$$;

update public.materials
set visibility_scope = 'admin_only'
where visibility_scope = 'public';

alter table public.materials
  add constraint materials_admin_only_visibility_check
  check (visibility_scope = 'admin_only');

-- Preserve the active instructor material flow after public materials are closed.
create or replace function public.can_access_material(target_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.materials m
    join public.courses c
      on c.id = m.course_id
    left join public.workspace_members instructor
      on instructor.id = c.instructor_member_id
      and instructor.user_id = auth.uid()
      and instructor.status = 'active'
      and instructor.role = 'instructor'
    left join public.workspace_members uploader
      on uploader.id = m.uploaded_by
      and uploader.user_id = auth.uid()
      and uploader.status = 'active'
    where m.id = target_material_id
      and (
        public.is_workspace_owner(m.workspace_id)
        or instructor.id is not null
        or uploader.id is not null
        or (
          m.visibility_scope = 'admin_only'
          and exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id = m.workspace_id
              and wm.user_id = auth.uid()
              and wm.role = 'group_admin'
              and wm.status = 'active'
          )
          and exists (
            select 1
            from public.course_groups cg
            where cg.course_id = m.course_id
              and cg.group_id in (select public.accessible_group_ids(m.workspace_id))
          )
        )
      )
  )
$$;

drop policy if exists "public materials anyone can read"
  on storage.objects;

drop policy if exists "users can view own payout account"
  on public.instructor_payout_accounts;
drop policy if exists "users can insert own payout account"
  on public.instructor_payout_accounts;
drop policy if exists "users can update own payout account"
  on public.instructor_payout_accounts;

drop policy if exists "instructors view own or owners view all settlement requests"
  on public.settlement_requests;
drop policy if exists "instructors create own settlement requests"
  on public.settlement_requests;
drop policy if exists "owners update settlement requests"
  on public.settlement_requests;

drop policy if exists "view items via parent request"
  on public.settlement_request_items;
drop policy if exists "insert items via parent request"
  on public.settlement_request_items;
drop policy if exists "view receipts via parent request"
  on public.settlement_request_receipts;
drop policy if exists "insert receipts via parent request"
  on public.settlement_request_receipts;

drop policy if exists "settlement participants can read receipt objects"
  on storage.objects;
drop policy if exists "instructors can upload receipt objects"
  on storage.objects;

revoke execute on function public.can_access_settlement_request(uuid) from public, anon, authenticated;

drop policy if exists "members can insert activity logs"
  on public.activity_logs;

create policy "members can insert activity logs"
on public.activity_logs for insert
to authenticated
with check (
  public.current_member_id(activity_logs.workspace_id) is not null
  and (
    activity_logs.actor_member_id is null
    or exists (
      select 1
      from public.workspace_members wm
      where wm.id = activity_logs.actor_member_id
        and wm.workspace_id = activity_logs.workspace_id
        and wm.status = 'active'
    )
  )
);
