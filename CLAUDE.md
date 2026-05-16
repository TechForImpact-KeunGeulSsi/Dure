@AGENTS.md
# DURE Project Context for Claude

이 파일은 DURE 프로젝트에서 Claude가 작업 전 현재 맥락(Context)을 빠르게 파악하기 위한 인수인계 문서입니다. 전반적인 개발 원칙과 도메인 지식은 `AGENTS.md`, `architecture.md`, `api-spec.md`를 최우선으로 따릅니다.

## 📍 현재 진행 상태 (Phase 8 완료 — 매직 링크 초대 정식화)

**완료된 단계:** 1~8 모두 완료.
**대기:** 9 (헤더 최근 활동, 자동 완료 cron).

### 자료 업로드 흐름 (단계 6 후속에서 단순화)
기존 `prepareMaterialUpload → 클라이언트 PUT to signed URL → completeMaterialUpload` 3단계 흐름이 SSR 환경에서 `"No suitable key or wrong key type"` 에러로 막혀, **server action에 FormData 직접 전송 + admin client `storage.upload()` 직접 호출** 흐름으로 통합되었습니다.

- 신규 server action: `uploadMaterial(workspaceId, courseId, formData)` — materials INSERT → material_groups INSERT → admin storage upload → upload_status='uploaded' 업데이트. 단계별 best-effort 롤백.
- `replaceMaterialFile`: 시그니처 변경 `(workspaceId, materialId, formData)`. 새 storage path 업로드 + 메타 업데이트 + 기존 파일 정리.
- Route Handler `/api/materials/upload-url`: 사용 중단 (410 응답). 외부 통합 호출 시 명확히 안내.
- 다운로드 signed URL 발급도 admin client 사용 (JWT 키 의존성 제거).

### 환경변수 핵심 (admin client 동작 전제)
admin client는 `SUPABASE_SERVICE_ROLE_KEY`가 service_role JWT일 때만 정상 동작합니다. **anon key를 service_role 자리에 잘못 넣은 경우 자료 업로드, 멤버 초대(`listUsers`/`generateLink`), storage signed URL 발급 등 모든 admin 작업이 `"No suitable key or wrong key type"`으로 실패**합니다.

`.env.local` 점검 시 확인:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase status의 "anon key">
SUPABASE_SERVICE_ROLE_KEY=<supabase status의 "service_role key">   # anon key와 다른 키
SUPABASE_JWT_SECRET=<supabase status의 "JWT secret">
APP_URL=http://localhost:3000   # 초대 매직 링크 redirect base
```
환경변수 변경 후 `rm -rf .next && npm run dev` 재시작 필수(환경변수는 hot reload 안 됨).

### 단계 8 매직 링크 초대 흐름

`createInvite`(`src/services/invites.ts`)가 단일 진입점. 흐름:

1. owner_admin이 dialog에서 역할/이메일/(그룹) 입력 → `createInvite` 호출
2. validator → 권한 → 부수 row 생성 (`workspace_members` placeholder, `workspace_member_groups` 또는 `invite_courses`)
3. `invites` insert (token_hash + expires_at=now+7d)
4. `admin.auth.admin.generateLink({ type, email, options: { redirectTo } })` — 기존 auth 사용자면 `magiclink`, 신규면 `invite`
5. `redirectTo = ${APP_URL}/auth/callback?next=/accept-invite?token=<raw>` — 기존 `auth/callback`이 code exchange 후 `/accept-invite`로 보냄
6. 클라이언트는 inviteUrl을 복사 가능하도록 UI에 노출 (로컬 SMTP 미구성 환경 대응)

수락은 기존 `acceptInvite` + `/api/invites/[token]/accept` + `accept-invite/page.tsx` 그대로. placeholder의 `user_id` 채우고 `status='active'`.

### 단계 7-8 sub-step 경로 (참고)

| Sub | 경로 |
|---|---|
| 7-1 강사 멤버 | `services/workspace-members.ts`, `lib/validators/workspace-member.ts`, `app/.../members/*` |
| 7-2 강사 콘솔 라우트 | `services/instructor-course.ts`, `components/courses/instructor-course-tabs.tsx`, `app/.../teach/courses/[id]/*` |
| 7-3 출석부 | `services/attendance.ts`, `lib/validators/attendance.ts`, `app/.../teach/.../attendance/*` |
| 7-4 수업 메모 | `services/class-memos.ts`, `app/.../teach/.../notes/*` |
| 7-5 출석 카운트 | `services/course-participants.ts` 갱신 |
| 6 후속 자료 업로드 | `services/materials.ts`(`uploadMaterial`, `replaceMaterialFile` 시그니처 변경), `app/.../materials/upload-dialog.tsx`, `app/.../materials/edit-dialog.tsx`, `app/api/materials/upload-url/route.ts`(410) |
| 8 초대 정식화 | `src/lib/invites/token.ts`(신규), `services/invites.ts`(`createInvite` 추가), `lib/validators/workspace-member.ts`(`CreateInviteSchema`), `app/.../members/invite-member-dialog.tsx`(신규), `members-client.tsx`/`page.tsx` 갱신 |

### admin client 우회 패턴 일관 적용
다음 테이블·작업은 모두 admin client를 사용합니다. RLS의 `... = current_member_id(workspace_id)` 정확 일치 비교가 SSR에서 통과되지 않는 케이스 회피용. 권한은 service 레이어에서 검증.

- `materials` INSERT/UPDATE/DELETE + storage upload/remove
- `material_groups` INSERT/DELETE
- `attendance_records` upsert
- `class_memos` upsert
- `workspace_members` INSERT/UPDATE (초대 + 수락 시 활성화)
- `invites` INSERT/UPDATE/SELECT (단계 8)
- `workspace_member_groups` INSERT (group_admin 초대 시)
- `invite_courses` INSERT (instructor 초대 시)

새 service 작성 시 같은 RLS 패턴을 가진 테이블이라면 같은 우회 적용 + README "단계 X RLS / 스펙 충돌" 섹션에 보고.

### 기타 특이사항

- **`loadCurrentMembership`**: 모든 service에서 `user_id = auth.uid()` 필터 필수 (RLS의 `current_member_id`와 정확 일치 보장). 7-3까지 일관 적용.
- **`CourseCard.viewType`**: 'manager' | 'instructor'. 홈 페이지가 본인 role 조회 후 결정. 다른 페이지에서 카드를 재사용할 때 viewType 전달 필요.
- **운영자용 출석부 진입점 없음**: api-spec §15가 운영자도 같은 계약 호출 가능하다고 명시하지만 운영자 콘솔에 출석부 탭이 없음. 후속 작업에서 추가 필요.
- **`auth.admin.listUsers` 격리**: `createInvite`의 자동 매핑 단계(매직 링크 type 분기용)가 환경변수 문제로 실패해도 초대 흐름이 멈추지 않도록 `findAuthUserIdByEmailSafe`에 try-catch. 매칭 실패 시 신규 사용자로 간주(`type: 'invite'`).
- **`generateLink` 이메일 발송**: Supabase JS의 `generateLink`는 SMTP/Inbucket이 활성화되어 있으면 자동으로 메일을 보냄. 로컬은 Inbucket(http://127.0.0.1:54324)에서 확인. 운영 환경은 `supabase/config.toml`의 `[auth.email.smtp]` 또는 Supabase 호스팅 SMTP 설정 필요.

## 🚀 다음 목표

남은 단계가 1개입니다:

**Phase 9: 헤더 최근 활동 + 자동 완료 cron**
- `activity_logs`는 단계 6/7/8 동안 채움 작업을 모두 미뤄둠. 자료 업로드/수정/삭제/확인 상태 변경, 출석 저장, 메모 저장, 초대 생성/수락 모두 활동 로그 대상.
- 자동 완료 cron: `/api/cron/complete-courses` Route Handler + Vercel Cron 또는 Supabase Edge Function. 종료일 지난 `courses.status='in_progress'`를 `completed`로 전환. (api-spec.md §17)

### 단계 8 후속 작업 (Phase 9와 별도로 미뤄둠)

- `getMembersPage` — 페이지네이션/검색/role/status 필터 (api-spec.md §6.1). 현재 `getWorkspaceMembers`는 전체 반환.
- `updateMember` — 역할 변경/비활성화/그룹 재배정 UI + 마지막 owner_admin 보호 (api-spec.md §6.3).
- `courseIds` 사전 배정 UI — instructor 초대 시 담당 수업 선택. validator/service는 이미 지원, UI만 미완.
- 만료된 초대 정리 cron — Phase 9 cron 인프라에 함께 추가.

작업 시작 전, Phase 5/6/7/8 공통 UI 컴포넌트(`components/ui/...`)와 페이지 패턴(서버 컴포넌트 + 클라이언트 컴포넌트 분리, `services/`를 통한 데이터 접근)을 그대로 따라 주세요. admin client 우회 패턴이 필요한 경우 README의 "RLS / 스펙 충돌" 섹션을 참고하고, 새 우회 추가 시 같은 형식으로 보고하세요.
