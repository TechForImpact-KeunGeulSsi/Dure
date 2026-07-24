# DURE Agent Instructions

이 문서는 DURE 레포에서 작업하는 에이전트의 기준 지침입니다. 오래된 단계별 인수인계보다 현재 기준 문서를 우선합니다.

## 우선순위 문서

1. `AGENTS.md`
2. `docs/STATUS.md`
3. `docs/context.md`
4. `docs/architecture.md`
5. `docs/api-spec.md`
6. `README.md`
7. `supabase/README.md`

작업을 시작할 때는 `docs/STATUS.md`의 현재 상태, blocker, 다음 작업을 먼저 확인합니다. 상태가 바뀌면 같은 파일을 갱신하고, 개인 Vault에는 작업 상태를 복제하지 않습니다.

이 브랜치에서는 과거 PRD, 발표 자료, brainstorm/spec 산출물을 작업 컨텍스트에 포함하지 않습니다. 필요한 과거 자료는 `main` 브랜치 또는 Git 이력에서 확인하고, 현재 구현 판단에는 최신 문서와 코드를 사용합니다.

## 작업 원칙

- 앱 코드는 `src/`, DB 기준은 `supabase/migrations/`, 현재 문서는 `docs/`에 둡니다.
- 발표 자료, 임시 이미지, 로컬 도구 상태, 과거 시행착오 문서는 루트에 두지 않습니다.
- 페이지는 업무 테이블을 직접 흩어 조회하지 않고 `src/services/`의 query/action을 사용합니다.
- 서버 컴포넌트는 데이터 로딩, 클라이언트 컴포넌트는 폼/모달/인터랙션 상태에 집중합니다.
- 새 입력/수정 흐름은 `src/lib/validators/`의 Zod schema를 통해 검증합니다.
- 권한 버튼 숨김은 UX 보조일 뿐이며, 실제 권한은 service 계층과 Supabase RLS/admin client 사용 지점에서 다시 검증합니다.

## Supabase/Admin Client 주의

`SUPABASE_SERVICE_ROLE_KEY`는 service_role JWT여야 합니다. anon key를 넣으면 자료 업로드, 멤버 초대, signed URL 발급, Auth admin 호출이 `"No suitable key or wrong key type"` 오류로 실패합니다.

admin client 우회는 RLS의 `current_member_id(workspace_id)` 비교가 SSR 환경에서 안정적으로 통과하지 않는 테이블에 한해 사용합니다. 이 경우 반드시 service 계층에서 권한을 먼저 검증하고, 새 우회가 생기면 README 또는 관련 문서에 이유를 남깁니다.

현재 admin client 우회가 사용되는 대표 작업:

- `materials`, `material_groups`
- `attendance_records`
- `class_memos`
- `workspace_members`
- `invites`, `invite_courses`, `workspace_member_groups`

## 현재 유지해야 할 구현 패턴

- `loadCurrentMembership`류 조회는 현재 사용자의 `user_id = auth.uid()` 필터를 포함해야 합니다.
- `CourseCard.viewType`은 `manager | instructor`를 명시적으로 전달합니다.
- 자료 업로드는 signed upload URL 3단계가 아니라 server action의 `FormData`와 admin `storage.upload()` 흐름을 사용합니다.
- `/api/materials/upload-url`은 사용 중단된 410 route입니다. 되살리지 않습니다.
- 초대 생성은 `src/services/invites.ts`의 `createInvite`를 단일 진입점으로 사용합니다.

## 레포 정리 기준

마스터 레포에는 다음만 남깁니다.

- 실행 가능한 제품 코드
- DB migration/config
- 현재 개발과 운영에 필요한 문서
- 실제 앱에서 참조하는 정적 자산

다음은 현재 브랜치에 두지 않습니다. 필요한 경우 `main` 브랜치 또는 Git 이력에서 확인합니다.

- `.DS_Store`, `.tmp-*`, 로컬 screenshot
- `.claude/`, `.codex/`, `.playwright-mcp/`, `.superpowers/`, `.vercel/`
- 발표 자료와 시연 GIF
- 과거 단계별 PRD/spec/mockup
- 일회성 데이터 추출 자료
