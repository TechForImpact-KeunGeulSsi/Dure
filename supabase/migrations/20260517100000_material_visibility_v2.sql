-- 수업 자료 공개 범위 재설계
-- 기존 enum 'all_course_groups' | 'selected_groups' → 'public' | 'admin_only'로 단순화
-- material_groups 테이블과 그룹 단위 세부 제한은 제거.
-- 'public' 자료는 비로그인 사용자도 다운로드 가능.

-- 1) 새 enum 정의 (임시 이름)
create type public.material_visibility_scope_v2 as enum ('public', 'admin_only');

-- 2) materials.visibility_scope 컬럼을 새 타입으로 마이그레이션
alter table public.materials
  add column visibility_scope_v2 public.material_visibility_scope_v2
  not null default 'admin_only';

-- 기존 모든 자료를 admin_only로 매핑 (보수적: 외부 노출 부작용 방지)
update public.materials set visibility_scope_v2 = 'admin_only';

-- 3) 기존 컬럼 제거 → 새 컬럼 이름 변경
alter table public.materials drop column visibility_scope;
alter table public.materials rename column visibility_scope_v2 to visibility_scope;

-- 4) 기존 enum 제거 후 새 enum 이름 정규화
drop type public.material_visibility_scope;
alter type public.material_visibility_scope_v2 rename to material_visibility_scope;

-- 5) material_groups 관련 트리거 / 함수 / 테이블 제거 (selected_groups 폐기)
drop trigger if exists ensure_material_group_is_course_group on public.material_groups;
drop trigger if exists reset_material_review_status_after_group_insert on public.material_groups;
drop trigger if exists reset_material_review_status_after_group_update on public.material_groups;
drop trigger if exists reset_material_review_status_after_group_delete on public.material_groups;
drop function if exists public.ensure_material_group_is_course_group();
drop table if exists public.material_groups cascade;

-- 6) reset_material_review_status 트리거의 함수 본문 갱신
-- (visibility_scope만 바뀌어도 review_status 리셋이 동작하도록 유지)
-- 기존 함수는 storage_path/visibility_scope 등 변경 시 리셋하도록 되어 있어
-- 그대로 두면 새 enum 값에서도 정상 동작. 별도 변경 불필요.

-- 7) can_access_material() 재정의 (CREATE OR REPLACE — 기존 정책 의존성 유지)
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
    left join public.workspace_members uploader
      on uploader.id = m.uploaded_by
      and uploader.user_id = auth.uid()
      and uploader.status = 'active'
    where m.id = target_material_id
      and (
        m.visibility_scope = 'public'
        or public.is_workspace_owner(m.workspace_id)
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

-- 8) 비로그인 사용자가 'public' 자료를 받을 수 있도록 storage RLS 정책 추가
-- 기존 'course members can read material objects' 정책은 인증 사용자용으로 유지.
create policy "public materials anyone can read"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = 'workspaces'
  and (storage.foldername(name))[3] = 'courses'
  and (storage.foldername(name))[5] = 'materials'
  and exists (
    select 1 from public.materials m
    where m.id = ((storage.foldername(name))[6])::uuid
      and m.visibility_scope = 'public'
  )
);
