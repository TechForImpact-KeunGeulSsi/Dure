-- 외부 제출 파일 생성 이력 (PR 통합 문서 10.3): 만든 사람, 시각, 기간, 조건, 넣은 항목을 남긴다.
-- 파일 내용(참여자 이름 등)은 저장하지 않는다.
create table public.report_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references public.workspace_members(id) on delete set null,
  format text not null check (format in ('xlsx', 'print')),
  period_label text not null check (length(trim(period_label)) > 0),
  start_date date not null,
  end_date date not null,
  filters jsonb not null default '{}'::jsonb,
  options jsonb not null default '{}'::jsonb,
  participant_row_count integer not null default 0 check (participant_row_count >= 0),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index report_exports_workspace_created_idx
  on public.report_exports (workspace_id, created_at desc);

alter table public.report_exports enable row level security;

-- 앱은 서비스에서 운영자 권한을 확인한 뒤 admin client로 기록하고 읽는다.
-- 클라이언트 직접 조회는 대표 운영자에게만 열어 둔다(별도 방어선).
create policy "owners can view report exports"
on public.report_exports for select
to authenticated
using (public.is_workspace_owner(workspace_id));
