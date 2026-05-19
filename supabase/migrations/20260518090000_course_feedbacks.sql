create type public.course_feedback_category as enum ('suggestion', 'praise', 'other');
create type public.course_feedback_status as enum ('new', 'reviewed');

create table public.course_feedbacks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_id uuid not null,
  course_name_snapshot text not null check (length(trim(course_name_snapshot)) > 0),
  category public.course_feedback_category not null,
  message text not null check (length(trim(message)) between 10 and 1000),
  author_name text check (author_name is null or length(trim(author_name)) > 0),
  author_phone text check (author_phone is null or length(trim(author_phone)) > 0),
  status public.course_feedback_status not null default 'new',
  privacy_consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, course_id) references public.courses(workspace_id, id) on delete cascade
);

create index course_feedbacks_workspace_created_idx
  on public.course_feedbacks(workspace_id, created_at desc);

create index course_feedbacks_course_created_idx
  on public.course_feedbacks(workspace_id, course_id, created_at desc);

create trigger set_course_feedbacks_updated_at
before update on public.course_feedbacks
for each row execute function public.set_updated_at();

alter table public.course_feedbacks enable row level security;
