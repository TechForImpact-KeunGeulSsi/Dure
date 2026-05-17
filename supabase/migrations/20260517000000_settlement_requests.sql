-- 비용 정산 요청 (Settlement Requests)
-- 강사가 수업 준비물/재료비 지출 후 영수증과 함께 정산을 요청하고,
-- 운영자가 "지급 완료"로 표시할 수 있도록 한다. 실제 송금 처리는 없음.

create type public.settlement_request_status as enum ('pending', 'paid');

-- 강사 본인의 계좌 정보 (워크스페이스별)
-- user_id 기준으로 본인만 R/W. 한 워크스페이스당 1개.
create table public.instructor_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_name text not null check (length(trim(bank_name)) > 0),
  account_number text not null check (length(trim(account_number)) > 0),
  account_holder text not null check (length(trim(account_holder)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- 정산 요청 헤더
-- 계좌 정보 3개를 스냅샷으로 저장 → 강사가 나중에 계좌를 수정해도
-- 기존 요청은 요청 시점 계좌 정보를 유지한다.
create table public.settlement_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  course_id uuid not null,
  instructor_member_id uuid not null references public.workspace_members(id) on delete restrict,
  bank_name_snapshot text not null,
  account_number_snapshot text not null,
  account_holder_snapshot text not null,
  memo text not null default '',
  total_amount bigint not null check (total_amount >= 0),
  status public.settlement_request_status not null default 'pending',
  paid_at timestamptz,
  paid_by uuid references public.workspace_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, course_id) references public.courses(workspace_id, id) on delete restrict,
  check (
    (status = 'paid' and paid_at is not null and paid_by is not null)
    or (status = 'pending' and paid_at is null and paid_by is null)
  )
);

-- 물품 라인 항목
-- subtotal은 quantity * unit_price로 DB에서 자동 계산되는 generated column.
create table public.settlement_request_items (
  id uuid primary key default gen_random_uuid(),
  settlement_request_id uuid not null references public.settlement_requests(id) on delete cascade,
  item_name text not null check (length(trim(item_name)) > 0),
  quantity integer not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  subtotal bigint generated always as (quantity::bigint * unit_price) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 영수증 첨부 (선택적, 다중 가능)
-- 스토리지 path는 'workspaces/{ws}/settlements/{requestId}/{fileId}-{name}' 형식.
create table public.settlement_request_receipts (
  id uuid primary key default gen_random_uuid(),
  settlement_request_id uuid not null references public.settlement_requests(id) on delete cascade,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 10485760),
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

-- updated_at 자동 갱신 트리거 (기존 set_updated_at 함수 재사용)
create trigger set_instructor_payout_accounts_updated_at
  before update on public.instructor_payout_accounts
  for each row execute function public.set_updated_at();

create trigger set_settlement_requests_updated_at
  before update on public.settlement_requests
  for each row execute function public.set_updated_at();

-- 정산 요청 접근 권한 체크 함수
-- owner_admin이거나, 요청한 강사 본인이면 true.
create function public.can_access_settlement_request(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.settlement_requests sr
    left join public.workspace_members wm
      on wm.id = sr.instructor_member_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
    where sr.id = target_request_id
      and (
        public.is_workspace_owner(sr.workspace_id)
        or wm.id is not null
      )
  )
$$;

-- 인덱스 (대시보드 목록/필터링 효율화)
create index settlement_requests_workspace_status_idx
  on public.settlement_requests(workspace_id, status, created_at desc);
create index settlement_requests_instructor_idx
  on public.settlement_requests(instructor_member_id, created_at desc);
create index settlement_request_items_request_idx
  on public.settlement_request_items(settlement_request_id, sort_order);
create index settlement_request_receipts_request_idx
  on public.settlement_request_receipts(settlement_request_id);

-- ───────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────

alter table public.instructor_payout_accounts enable row level security;
alter table public.settlement_requests enable row level security;
alter table public.settlement_request_items enable row level security;
alter table public.settlement_request_receipts enable row level security;

-- instructor_payout_accounts: 본인만 R/W
create policy "users can view own payout account"
on public.instructor_payout_accounts for select
to authenticated
using (user_id = auth.uid() and public.current_member_id(workspace_id) is not null);

create policy "users can insert own payout account"
on public.instructor_payout_accounts for insert
to authenticated
with check (user_id = auth.uid() and public.current_member_id(workspace_id) is not null);

create policy "users can update own payout account"
on public.instructor_payout_accounts for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- settlement_requests SELECT: 요청자 본인 또는 owner_admin
create policy "instructors view own or owners view all settlement requests"
on public.settlement_requests for select
to authenticated
using (
  public.is_workspace_owner(workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.id = settlement_requests.instructor_member_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

-- settlement_requests INSERT: 본인이 강사로 배정된 수업에 대해서만
create policy "instructors create own settlement requests"
on public.settlement_requests for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.id = settlement_requests.instructor_member_id
      and wm.user_id = auth.uid()
      and wm.role = 'instructor'
      and wm.status = 'active'
  )
  and exists (
    select 1
    from public.courses c
    where c.id = settlement_requests.course_id
      and c.workspace_id = settlement_requests.workspace_id
      and c.instructor_member_id = settlement_requests.instructor_member_id
  )
);

-- settlement_requests UPDATE: owner_admin만 (status='paid' 처리용)
create policy "owners update settlement requests"
on public.settlement_requests for update
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

-- settlement_request_items: parent의 정책 상속
create policy "view items via parent request"
on public.settlement_request_items for select
to authenticated
using (public.can_access_settlement_request(settlement_request_id));

create policy "insert items via parent request"
on public.settlement_request_items for insert
to authenticated
with check (public.can_access_settlement_request(settlement_request_id));

-- settlement_request_receipts: parent의 정책 상속
create policy "view receipts via parent request"
on public.settlement_request_receipts for select
to authenticated
using (public.can_access_settlement_request(settlement_request_id));

create policy "insert receipts via parent request"
on public.settlement_request_receipts for insert
to authenticated
with check (public.can_access_settlement_request(settlement_request_id));

-- ───────────────────────────────────────────────
-- Storage RLS (영수증)
-- 기존 'course-materials' 버킷 재사용, 경로로 구분: workspaces/{ws}/settlements/{requestId}/*
-- ───────────────────────────────────────────────

create policy "settlement participants can read receipt objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = 'workspaces'
  and (storage.foldername(name))[3] = 'settlements'
  and public.can_access_settlement_request(((storage.foldername(name))[4])::uuid)
);

create policy "instructors can upload receipt objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = 'workspaces'
  and (storage.foldername(name))[3] = 'settlements'
  and public.can_access_settlement_request(((storage.foldername(name))[4])::uuid)
);
