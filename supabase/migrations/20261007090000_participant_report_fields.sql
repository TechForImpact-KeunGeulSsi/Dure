-- 보고용 참여자 정보: 센터 내부 번호, 성별, 출생연도, 장애 유무
-- 연령대는 저장하지 않고 출생연도에서 계산한다. 장애 유형·진단명은 저장하지 않는다.
alter table public.participants
  add column if not exists internal_no text,
  add column if not exists gender text,
  add column if not exists birth_year integer,
  add column if not exists has_disability boolean;

alter table public.participants
  add constraint participants_internal_no_not_blank
    check (internal_no is null or length(trim(internal_no)) > 0),
  add constraint participants_gender_check
    check (gender is null or gender in ('female', 'male')),
  add constraint participants_birth_year_check
    check (birth_year is null or birth_year between 1900 and 2100);

create unique index if not exists participants_workspace_internal_no_key
  on public.participants (workspace_id, internal_no)
  where internal_no is not null and deleted_at is null;
