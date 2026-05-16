@AGENTS.md
# DURE Project Context for Claude

이 파일은 DURE 프로젝트에서 Claude가 작업 전 현재 맥락(Context)을 빠르게 파악하기 위한 인수인계 문서입니다. 전반적인 개발 원칙과 도메인 지식은 `AGENTS.md`, `architecture.md`, `api-spec.md`를 최우선으로 따릅니다.

## 📍 현재 진행 상태 (Phase 7 완료 + 자료 업로드 흐름 단순화)

**완료된 단계:** 1~7 모두 완료.
**부분 완료:** 8 (강사 초대만, 정식 매직 링크 발급/그룹 운영자 초대 미구현).
**대기:** 9 (헤더 최근 활동, 자동 완료 cron).

### 자료 업로드 흐름 (단계 6 후속에서 단순화)
기존 `prepareMaterialUpload → 클라이언트 PUT to signed URL → completeMaterialUpload` 3단계 흐름이 SSR 환경에서 `"No suitable key or wrong key type"` 에러로 막혀, **server action에 FormData 직접 전송 + admin client `storage.upload()` 직접 호출** 흐름으로 통합되었습니다.

- 신규 server action: `uploadMaterial(workspaceId, courseId, formData)` — materials INSERT → material_groups INSERT → admin storage upload → upload_status='uploaded' 업데이트. 단계별 best-effort 롤백.
- `replaceMaterialFile`: 시그니처 변경 `(workspaceId, materialId, formData)`. 새 storage path 업로드 + 메타 업데이트 + 기존 파일 정리.
- Route Handler `/api/materials/upload-url`: 사용 중단 (410 응답). 외부 통합 호출 시 명확히 안내.
- 다운로드 signed URL 발급도 admin client 사용 (JWT 키 의존성 제거).

### 환경변수 핵심 (admin client 동작 전제)
admin client는 `SUPABASE_SERVICE_ROLE_KEY`가 service_role JWT일 때만 정상 동작합니다. **anon key를 service_role 자리에 잘못 넣은 경우 자료 업로드, 강사 초대(`listUsers`), storage signed URL 발급 등 모든 admin 작업이 `"No suitable key or wrong key type"`으로 실패**합니다.

`.env.local` 점검 시 확인:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase status의 "anon key">
SUPABASE_SERVICE_ROLE_KEY=<supabase status의 "service_role key">   # anon key와 다른 키
SUPABASE_JWT_SECRET=<supabase status의 "JWT secret">
```
환경변수 변경 후 `rm -rf .next && npm run dev` 재시작 필수(환경변수는 hot reload 안 됨).

### 단계 7 sub-step 경로 (참고)

| Sub | 경로 |
|---|---|
| 7-1 강사 멤버 | `services/workspace-members.ts`, `lib/validators/workspace-member.ts`, `app/.../members/*` |
| 7-2 강사 콘솔 라우트 | `services/instructor-course.ts`, `components/courses/instructor-course-tabs.tsx`, `app/.../teach/courses/[id]/*` |
| 7-3 출석부 | `services/attendance.ts`, `lib/validators/attendance.ts`, `app/.../teach/.../attendance/*` |
| 7-4 수업 메모 | `services/class-memos.ts`, `app/.../teach/.../notes/*` |
| 7-5 출석 카운트 | `services/course-participants.ts` 갱신 |
| 6 후속 자료 업로드 | `services/materials.ts`(`uploadMaterial`, `replaceMaterialFile` 시그니처 변경), `app/.../materials/upload-dialog.tsx`, `app/.../materials/edit-dialog.tsx`, `app/api/materials/upload-url/route.ts`(410) |

### admin client 우회 패턴 일관 적용
다음 테이블·작업은 모두 admin client를 사용합니다. RLS의 `... = current_member_id(workspace_id)` 정확 일치 비교가 SSR에서 통과되지 않는 케이스 회피용. 권한은 service 레이어에서 검증.

- `materials` INSERT/UPDATE/DELETE + storage upload/remove
- `material_groups` INSERT/DELETE
- `attendance_records` upsert
- `class_memos` upsert
- `workspace_members` INSERT (강사 초대)

새 service 작성 시 같은 RLS 패턴을 가진 테이블이라면 같은 우회 적용 + README "단계 X RLS / 스펙 충돌" 섹션에 보고.

### 기타 특이사항

- **`loadCurrentMembership`**: 모든 service에서 `user_id = auth.uid()` 필터 필수 (RLS의 `current_member_id`와 정확 일치 보장). 7-3까지 일관 적용.
- **`CourseCard.viewType`**: 'manager' | 'instructor'. 홈 페이지가 본인 role 조회 후 결정. 다른 페이지에서 카드를 재사용할 때 viewType 전달 필요.
- **운영자용 출석부 진입점 없음**: api-spec §15가 운영자도 같은 계약 호출 가능하다고 명시하지만 운영자 콘솔에 출석부 탭이 없음. 후속 작업에서 추가 필요.
- **`auth.admin.listUsers` 격리**: `inviteInstructor`의 자동 매핑 단계가 환경변수 문제로 실패해도 강사 초대 자체는 invited 상태로 진행되도록 `findAuthUserIdByEmailSafe`에 try-catch.

## 🚀 다음 목표 (선택지)

남은 단계가 2개입니다:

1. **Phase 8: 사용자 초대/권한 설정 정식화**
   - 그룹 운영자 초대 (강사 외 역할).
   - `invites` 테이블을 활용한 정식 매직 링크 발급 흐름 (`createInvite` 액션).
   - 단계 7-1의 `inviteInstructor`는 admin client로 직접 `workspace_members`에 insert하는 단순 방식. Phase 8 정식 흐름이 들어오면 `invites` 테이블 경유로 리팩토링 가능(token 발급 → 이메일 발송 → 수락 시 `workspace_members.user_id` 매핑).
   - api-spec.md §6 참고.

2. **Phase 9: 헤더 최근 활동 + 자동 완료 cron**
   - `activity_logs`는 단계 6/7 동안 채움 작업을 모두 미뤄둠. 자료 업로드/수정/삭제/확인 상태 변경, 출석 저장, 메모 저장 모두 활동 로그 대상.
   - 자동 완료 cron: `/api/cron/...` Route Handler + Vercel Cron 또는 Supabase Edge Function. 종료일 지난 `courses.status='in_progress'`를 `completed`로 전환.

작업 시작 전, Phase 5/6/7 공통 UI 컴포넌트(`components/ui/...`)와 페이지 패턴(서버 컴포넌트 + 클라이언트 컴포넌트 분리, `services/`를 통한 데이터 접근)을 그대로 따라 주세요. admin client 우회 패턴이 필요한 경우 README의 "RLS / 스펙 충돌" 섹션을 참고하고, 새 우회 추가 시 같은 형식으로 보고하세요.