-- workspace_members 에 운영자용 메모 컬럼을 추가한다.
-- participants.memo 와 동일한 패턴(nullable text). RLS는 기존 workspace_members
-- 정책으로 충분(row-level이라 column 추가가 정책 변경을 요구하지 않음).
alter table public.workspace_members add column memo text;
