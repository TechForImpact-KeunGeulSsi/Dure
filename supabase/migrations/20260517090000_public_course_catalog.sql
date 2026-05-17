create type public.course_public_visibility as enum ('public', 'hidden');

alter table public.courses
  add column public_visibility public.course_public_visibility not null default 'public';

create index courses_public_catalog_idx
on public.courses(public_visibility, status, updated_at desc, created_at desc);
