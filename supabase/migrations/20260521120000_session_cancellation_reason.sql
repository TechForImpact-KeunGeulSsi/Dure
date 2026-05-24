-- 수업 생성·운영 시 회차 휴강 사유 저장 (progress_status = cancelled)
alter table public.course_sessions
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.workspace_members(id) on delete set null;
