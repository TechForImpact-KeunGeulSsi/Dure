-- 저출석자 연락 결과: 수업·참여자·월마다 한 줄. 문자 발송 기록이 아니라 운영자가 직접 남기는 메모다.
create table public.attendance_contact_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_id uuid not null,
  participant_id uuid not null,
  month date not null check (extract(day from month) = 1),
  result text not null check (result in ('reached', 'no_answer', 'other')),
  note text check (note is null or length(note) <= 500),
  updated_by uuid references public.workspace_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, participant_id, month),
  foreign key (workspace_id, course_id) references public.courses(workspace_id, id) on delete cascade,
  foreign key (workspace_id, participant_id) references public.participants(workspace_id, id) on delete restrict
);

create index attendance_contact_notes_workspace_month_idx
  on public.attendance_contact_notes (workspace_id, month);

create trigger set_attendance_contact_notes_updated_at
  before update on public.attendance_contact_notes
  for each row execute function public.set_updated_at();

alter table public.attendance_contact_notes enable row level security;

-- 앱은 서비스에서 운영자 권한을 확인한 뒤 admin client로 읽고 쓴다. RLS는 별도 방어선이다.
create policy "course members can view attendance contact notes"
on public.attendance_contact_notes for select
to authenticated
using (public.can_access_course(course_id));

create policy "course members can manage attendance contact notes"
on public.attendance_contact_notes for all
to authenticated
using (public.can_access_course(course_id))
with check (
  public.can_access_course(course_id)
  and updated_by = public.current_member_id(workspace_id)
);
