# DURE

여러 운영 단위의 수업, 참여자, 강사, 일정, 자료, 출석 기록을 한 워크스페이스 안에서 관리하는 웹 서비스.

상세한 제품 범위와 설계는 다음 문서를 따른다.

- [prd.md](prd.md) — 제품 요구사항, 화면 책임, 수락 기준
- [architecture.md](architecture.md) — 기술 구조, 데이터 모델, 권한 설계
- [context.md](context.md) — 용어 기준
- [docs/api-spec.md](docs/api-spec.md) — 페이지별 query/action 계약
- [docs/environment.md](docs/environment.md) — 환경 변수와 로컬 셋업
- [supabase/README.md](supabase/README.md) — DB 베이스라인과 RPC
- [AGENTS.md](AGENTS.md) — 작업 지침

## 기술 스택

- **Frontend/Backend**: Next.js 15 App Router + React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Auth/DB/Storage**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **검증**: Zod
- **날짜**: date-fns

## 디렉토리

```
app/
  workspaces/[workspaceId]/(dashboard)/
    home/                  # 운영자: 전체 수업 / 강사: 담당 수업 (role 기반 분기)
    calendar/              # 월간 일정 관리
    members/               # 사용자 초대/권한 설정 (강사 초대 — 단계 7)
    courses/[courseId]/    # 운영자용 수업 상세
      home/
      materials/
      participants/
    teach/courses/[courseId]/  # 강사 콘솔 (단계 7)
      home/                # 강사용 수업 홈
      materials/           # 자료 (단계 6 컴포넌트 재사용)
      attendance/          # 출석부 + 회차별 메모
      notes/               # 전체 회차 메모 한눈에 보기
    manage/                # 그룹·수업·참여자 관리 허브
  api/
    invites/[token]/accept/route.ts
    materials/
      upload-url/route.ts                  # 사용 중단 (410). 단계 6 자료 업로드는 server action으로 통합.
      [materialId]/download/route.ts       # signed download URL 발급
components/
  courses/
    course-card.tsx          # viewType prop으로 운영자/강사 라우팅 분기
    course-detail-tabs.tsx
    instructor-course-tabs.tsx
lib/
  supabase/{client,server,admin}.ts
  validators/
    material.ts
    workspace-member.ts
    attendance.ts
services/
  courses.ts, course-detail.ts, course-sessions.ts, course-participants.ts
  materials.ts             # 자료 (단계 6 + FormData server action 흐름)
  workspace-members.ts     # 강사 초대 (단계 7)
  instructor-course.ts     # 강사용 수업 홈
  attendance.ts            # 출석부 + 수업 메모 저장
  class-memos.ts           # 회차별 메모 목록
supabase/                  # DB migration
```

## 로컬 셋업

1. **Docker Desktop**을 켠다.
2. **Supabase CLI**를 설치.
3. 로컬 Supabase를 띄운다.
   ```bash
   supabase login
   supabase link --project-ref oyoexxqaeayaksfoixxr
   supabase db reset
   ```
4. **환경 변수 — admin client 동작 핵심:**
   ```bash
   cp .env.example .env.local
   supabase status
   ```
   `supabase status` 출력의 다음 값을 `.env.local`과 **정확히** 매핑한다(혼동 시 자료 업로드·강사 초대 등 admin 작업에서 `"No suitable key or wrong key type"` 에러가 발생):
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase status의 "anon key">
   SUPABASE_SERVICE_ROLE_KEY=<supabase status의 "service_role key">   # ← anon key와 다른 키. 혼동 주의
   SUPABASE_JWT_SECRET=<supabase status의 "JWT secret">
   ```
   환경 변수 수정 후 `.next` 캐시를 비우고 dev 서버를 재시작한다:
   ```bash
   rm -rf .next && npm run dev
   ```
5. 의존성 설치 및 개발 서버 실행:
   ```bash
   npm install && npm run dev
   ```
   - 앱: http://localhost:3000
   - Supabase Studio: http://127.0.0.1:54323
   - 매직 링크 메일(Inbucket): http://127.0.0.1:54324

## 진행 상황

| # | 단계 | 상태 |
| --- | --- | --- |
| 1 | Supabase 프로젝트, Auth, 기본 DB migration, RLS helper | ✅ 완료 |
| 2 | 워크스페이스 생성과 멤버십 모델 | ✅ 완료 |
| 3 | 그룹, 참여자, 그룹 배정 CRUD | ✅ 완료 |
| 4 | 수업 생성, 반복 회차 생성, 수업-참여자 배정 | ✅ 완료 |
| 5 | 운영자용 수업 목록/상세와 캘린더 | ✅ 완료 |
| 6 | 자료 업로드, 공개 그룹, 확인 상태 | ✅ 완료 |
| 7 | 강사 콘솔(자료/출석부/수업 메모) + 강사 초대 | ✅ 완료 |
| 8 | 사용자 초대/권한 설정 정식화(그룹 운영자 초대, 매직 링크 발급) | ✅ 완료 |
| 8B | 워크스페이스 참여 요청(Join Request) 흐름 — 사용자 → 운영자 방향 | ✅ 완료 |
| 9 | 헤더 최근 활동(activity_logs) | ✅ 완료 |
| 10 | 캘린더 백엔드 연동 + 일반 일정 CRUD | ✅ 완료 |
| 11 | 1차 MVP 테스트 | ✅ 완료 |
| 12 | UI 개선 | 진행중-박수현 |

### 단계 2~5 요약

이전 단계 내용은 git 히스토리 참고. 핵심:
- 단계 2: Supabase 클라이언트 3종, SSR 미들웨어, 워크스페이스 생성, 초대 수락.
- 단계 3: 그룹·참여자 CRUD. `groups.ts`에 admin client 우회(RLS 스펙 충돌).
- 단계 4: 수업 생성/반복 회차/참여자 배정. `getCourseFormOptions`가 강사 멤버 드롭다운 옵션 반환.
- 단계 5: 운영자용 수업 상세 뼈대(3탭), 캘린더, mock 데이터 연동.

### 단계 6에서 구현한 것

- **자료 도메인 서비스 [services/materials.ts](src/services/materials.ts):** api-spec.md §11의 7개 계약 + 운영 편의용 `deleteMaterial`. 단계 6 후속 작업에서 흐름을 단순화(아래 §"단계 6 후속" 참고).
- **Zod 검증기, Route Handler(다운로드 URL).**
- **자료 탭 UI 6개 파일** (page/materials-client/material-row/visibility-fields/upload-dialog/edit-dialog).
- **mock 정리:** 단계 5 mock을 실 DB로 전환(대시보드 홈, 수업 상세 layout, 수업 홈 탭, 참여자 현황 탭, 자료 탭). 신규 서비스 [course-detail.ts](src/services/course-detail.ts), [course-sessions.ts](src/services/course-sessions.ts), [course-participants.ts](src/services/course-participants.ts).

### 단계 6 후속: 자료 업로드 흐름 단순화

기존 흐름(`prepareMaterialUpload` → 클라이언트 PUT to signed URL → `completeMaterialUpload`)이 SSR 환경에서 `"No suitable key or wrong key type"` 에러로 막혔다. signed URL과 클라이언트 PUT 의존성을 모두 제거하고 **FormData를 서버 액션에 직접 전송 → admin client `storage.upload()` 직접 호출** 흐름으로 통합했다.

- 신규 서버 액션 `uploadMaterial(workspaceId, courseId, formData)`: materials INSERT → material_groups INSERT(필요 시) → admin storage upload → upload_status='uploaded' 업데이트. 실패 시 단계별 best-effort 롤백.
- `replaceMaterialFile`: 시그니처 변경 (`(workspaceId, materialId, formData)`). 새 storage path 업로드 후 메타 업데이트, 기존 파일 정리.
- Route Handler [app/api/materials/upload-url/route.ts](src/app/api/materials/upload-url/route.ts): 사용 중단(410 응답). 외부 통합에서 호출 시 명확히 안내.
- 다운로드 signed URL 발급도 admin client로 일관(JWT 키 의존성 제거).

### 단계 6 RLS / 스펙 충돌 (보고 사항 — AGENTS.md §2)

`materials` 테이블의 INSERT 정책이 `uploaded_by = current_member_id(workspace_id)` 정확 일치를 요구하지만 SSR 환경에서 통과되지 않는 케이스가 있어 INSERT/UPDATE/DELETE를 admin client로 우회한다. 권한은 service 레이어에서 검증(`canEditMaterial`, `canChangeReviewStatus`). 같은 이유로 단계 7의 `attendance_records`/`class_memos`도 admin client 우회.

### 단계 7에서 구현한 것

7-1 ~ 7-6 sub-step으로 진행됨.

- **7-1 강사 멤버 추가 (`/members`):**
  - [services/workspace-members.ts](src/services/workspace-members.ts) — `getWorkspaceMembers`, `inviteInstructor`.
  - 같은 이메일의 auth user가 가입돼 있으면 `user_id` 자동 매핑 + `active`, 아니면 `invited`.
  - `auth.admin.listUsers` 호출이 환경변수 등으로 실패해도 `invited` 상태로 강사 추가가 진행되도록 `try-catch`로 격리.
- **7-2 강사 콘솔 라우트 (`/teach/courses/[id]`):**
  - [services/instructor-course.ts](src/services/instructor-course.ts) — `getInstructorCourseHome` (api-spec.md §13.1).
  - 강사 콘솔 layout + 4탭(수업 홈/자료/출석부/메모).
  - `CourseCard.viewType` prop + 홈에서 role 판정해 카드 라우팅 분기.
- **7-3 출석부 + 회차 메모 (`/teach/.../attendance`):**
  - [services/attendance.ts](src/services/attendance.ts) — `getAttendanceBook`, `saveAttendance`, `saveClassMemo` (api-spec.md §15.1~§15.3). admin client 우회.
- **7-4 수업 메모 탭 (`/teach/.../notes`):**
  - [services/class-memos.ts](src/services/class-memos.ts) — 전체 회차 + 메모 목록. 회차별 inline 편집.
- **7-5 참여자 현황 출석 카운트 채우기:**
  - [services/course-participants.ts](src/services/course-participants.ts) 갱신 — `attendance_records` 집계. `attendanceRate = (present + partial × 0.5) / rollup_included_session_count × 100`.
- **7-6 문서 갱신.**

### 단계 7 RLS / 스펙 충돌 (보고 사항)

`attendance_records`/`class_memos` 정책은 단계 6 `materials`와 같은 패턴이라 admin client 우회를 사용. 권한 검증은 service 레이어(`canAccessCourse` — 강사는 `instructor_member_id` 매칭, owner는 통과, group_admin은 `accessible_group_ids` 교차).

### 단계 8에서 구현한 것

api-spec.md §6 계약의 핵심을 정식화. `createInvite` + `acceptInvite` 양방향이 함께 동작한다.

- **토큰 유틸 [src/lib/invites/token.ts](src/lib/invites/token.ts):** `generateInviteToken`(crypto.randomBytes 32바이트, base64url) + `hashInviteToken`(sha256 hex). 동일 해싱이 `acceptInvite` lookup에 재사용된다.
- **Validator [src/lib/validators/workspace-member.ts](src/lib/validators/workspace-member.ts):** `CreateInviteSchema` — role + groupIds + courseIds. `group_admin` → groupIds 1개 이상 필수 검증(superRefine).
- **`createInvite` 액션 [src/services/invites.ts](src/services/invites.ts):**
  1. Zod 검증 → owner_admin 권한 확인 → role-scoped IDs 워크스페이스 소속 검증 → 중복 이메일 검증
  2. `workspace_members` placeholder (status='invited', user_id=null)
  3. role별 부수 효과: `group_admin` → `workspace_member_groups` insert, `instructor` → `invite_courses` insert
  4. `invites` insert (token_hash, expires_at=now+7d, role)
  5. `admin.auth.admin.generateLink({ type: 'magiclink' | 'invite', email, options: { redirectTo } })` — 기존 auth 사용자면 `magiclink`, 미가입이면 `invite` (계정 자동 생성)
  6. `redirectTo = ${APP_URL}/auth/callback?next=/accept-invite?token=<raw>` — 기존 `auth/callback`이 code exchange 후 `/accept-invite`로 보냄
  7. 실패 시 단계별 best-effort 롤백 (invite_courses → invites → workspace_member_groups → workspace_members)
- **수락 흐름은 기존 [`acceptInvite`](src/services/invites.ts) + [`/api/invites/[token]/accept`](src/app/api/invites/[token]/accept/route.ts) 재사용** — placeholder의 user_id 채우고 status='active'.
- **UI [invite-member-dialog.tsx](src/app/workspaces/[workspaceId]/\(dashboard\)/members/invite-member-dialog.tsx):**
  - 역할(강사/그룹 운영자), 이메일, 이름 입력 + group_admin 선택 시 그룹 다중 선택
  - 성공 후 inviteUrl 표시 + 복사 버튼 — 로컬은 Inbucket(http://127.0.0.1:54324)에서 메일 확인, 운영자가 직접 전달도 가능
- **기존 `inviteInstructor` 제거.** `workspace-members.ts`는 목록 조회만 유지 + `canInviteMembers` 플래그.

### 단계 8 RLS / 스펙 충돌 (보고 사항)

`invites`, `invite_groups`, `invite_courses`, `workspace_members` 모두 admin client 우회 — 정책이 owner_admin SELECT만 허용하거나 SSR에서 `current_member_id` 비교가 통과되지 않는 패턴. 권한은 service 레이어에서 owner_admin 활성 멤버십 확인으로 검증.

### 단계 8에서 다루지 않은 것 (후속)

- **`getMembersPage` 정식화:** 페이지네이션/검색/role/status 필터. 현재는 `getWorkspaceMembers`가 전체 반환.
- **`updateMember`:** 역할 변경/비활성화/그룹 재배정 UI. 마지막 owner_admin 보호 룰 포함.
- **`courseIds` 사전 배정:** instructor 초대 시 담당 수업 미리 지정 UI. validator/service는 이미 지원, UI만 미완.
- **만료 초대 정리 cron:** 단계 9의 자동 완료 cron과 함께 처리 예정.
- **활동 로그(`activity_logs`) INSERT:** `createInvite`/`acceptInvite` 이벤트는 단계 9에서 일괄 추가.

### 단계 8B에서 구현한 것 — 워크스페이스 참여 요청

기존 단방향(owner → invitee) 매직 링크 초대 흐름에 더해, 반대 방향(user → owner) 참여 요청 흐름을 도입했다. 두 흐름은 자연스럽게 공존한다.

- **신규 테이블 `workspace_join_requests`** ([supabase/migrations/20260516000000_workspace_join_requests.sql](supabase/migrations/20260516000000_workspace_join_requests.sql)):
  - 컬럼: workspace_id, user_id, email, display_name, desired_role, message, status(`pending`|`approved`|`rejected`|`canceled`), reject_reason, reviewed_by/at, timestamps
  - 부분 unique index `(workspace_id, user_id) where status='pending'` — 동시 pending 1개 보장
  - RLS: 본인 요청 + owner_admin이 자기 워크스페이스 요청 SELECT 가능. INSERT는 본인. UPDATE는 admin client 우회.
  - 같은 migration에서 `workspaces`에 디스커버용 SELECT 정책(`to authenticated using (true)`) 추가 — id/name/timezone만 의미 있는 노출.
- **검증** [src/lib/validators/join-request.ts](src/lib/validators/join-request.ts): `RequestAccessSchema`(desiredRole + 이름/메시지 옵션), `ApproveJoinRequestSchema`(role + group_admin이면 groupIds ≥ 1).
- **서비스** [src/services/join-requests.ts](src/services/join-requests.ts):
  - `listDiscoverableWorkspaces({ search, page, pageSize })` — 이름 ilike 검색 + 페이지네이션. 본인 멤버십 상태, 멤버 수, pending 요청을 한 번에 매핑.
  - `requestWorkspaceAccess(workspaceId, input)` — 본인 user_id로 INSERT, 중복(active/invited/pending) 차단.
  - `cancelMyJoinRequest(requestId)` — 본인 pending → canceled.
  - `listWorkspaceJoinRequests(workspaceId, { status })` — owner_admin 전용.
  - `approveJoinRequest(workspaceId, requestId, { role, groupIds? })` — 기존 invited placeholder가 있으면 활성화, 없으면 신규 INSERT. group_admin이면 `workspace_member_groups` 동기화.
  - `rejectJoinRequest(workspaceId, requestId, reason?)`.
- **UI**:
  - `/workspaces/discover` ([page](src/app/workspaces/discover/page.tsx) + [client](src/app/workspaces/discover/discover-client.tsx) + [dialog](src/app/workspaces/discover/request-access-dialog.tsx)): 검색 바(300ms 디바운스 URL `?q=` 동기화) + 카드 그리드 + 상태별 CTA(입장/초대 받음/요청 대기 중·취소/참여 요청) + 페이지네이션.
  - `/workspaces` 페이지에 "다른 워크스페이스 둘러보기" 링크 추가, `/workspaces/new`의 `JoinExistingHint`를 디스커버 링크로 교체.
  - `/workspaces/{id}/members`에 "참여 요청" 섹션(owner_admin & pending ≥ 1일 때) — 카드별 수락(역할/그룹 확정 다이얼로그) + 거부(사유 prompt).
- **api-spec.md / architecture.md**: 정식 스펙은 미반영(스펙 외 추가 기능). 후속 plan에서 §6에 통합 검토.

### 단계 8B RLS / 스펙 충돌 (보고 사항)

- `workspaces` 테이블에 디스커버 SELECT 정책을 추가해 인증 사용자에게 워크스페이스 행이 노출됨. 노출 컬럼은 id/name/timezone/created_at. 자식 테이블(`groups`, `participants`, `courses`, `materials`, …)의 RLS는 그대로 유지되어 내부 데이터 보호.
- `workspace_join_requests` INSERT/UPDATE는 admin client 우회 패턴 적용(기존 invites/materials와 동일). 권한 검증은 service 레이어.

### 단계 8B에서 다루지 않은 것 (후속)

- 워크스페이스별 public/private 토글 (현재는 전체 공개)
- 거부 사유 사용자 노출 UI
- 요청 알림(메일/푸시) — 현재는 멤버 페이지 폴링 기반
- Activity log 연동(`join_requested`/`join_approved`/`join_rejected`)은 Phase 9 이후 추가

### 단계 9에서 구현한 것 — 헤더 최근 활동 (activity_logs)

api-spec.md §16 `getRecentActivity` 정식 구현 + 7개 service에 logging 훅. 모든 활성 멤버가 권한 필터링된 활동 피드를 헤더 종 아이콘 드롭다운에서 본다.

- **신규 [src/services/activity.ts](src/services/activity.ts):**
  - `logActivity(...)`: fire-and-forget. admin client로 `activity_logs` INSERT, 실패해도 절대 throw 안 함(console.warn만). 호출 측 비즈니스 로직 보호.
  - `getRecentActivity({ workspaceId, limit })`: 최근 활동 fetch + 권한별 필터 + title/description/href 포맷팅. 멤버 대상 이벤트는 owner_admin만, 그 외 course-bound 이벤트는 `canAccessCourse` 통과한 사용자만.
- **신규 [src/services/access.ts](src/services/access.ts):** 공통 `loadCurrentMembership` + `canAccessCourse`. activity.ts와 향후 service들이 공유. attendance.ts의 기존 private 복사본은 점진 마이그레이션 대상으로 그대로 유지.
- **logging 훅 추가 (7곳):**
  - [materials.ts](src/services/materials.ts): `uploadMaterial`(`material_uploaded`), `updateMaterial`(`material_updated`), `replaceMaterialFile`(`material_file_replaced`)
  - [attendance.ts](src/services/attendance.ts): `saveAttendance`(`attendance_saved`), `saveClassMemo`(`class_memo_saved`)
  - [invites.ts](src/services/invites.ts): `createInvite`(`invite_created`), `acceptInvite`(`invite_accepted`)
- **[헤더 UI](src/components/layout/header.tsx) 갱신:** Bell 드롭다운이 실제 데이터로 채워짐. lazy fetch(첫 open 시 1회), actor 이니셜 아바타 + 제목 + 보조설명 + 상대 시간(방금 전 / N분 전 / N시간 전 / N일 전) + 클릭 시 `target.href`로 이동.
- **공통 타입은 [src/lib/api/types.ts](src/lib/api/types.ts)에 `ActivityItem`, `ActivityTarget`, `LoggableTargetType` 추가** — client component가 server action 파일에서 직접 type import 시 발생하는 빌드 이슈 회피.

### 단계 9 RLS / 스펙 충돌 (보고 사항)

`activity_logs` SELECT 정책은 owner_admin만 허용하지만 api-spec.md §16은 모든 멤버에게 권한 필터링된 노출을 정의. SELECT/INSERT 모두 admin client 우회. 권한 필터는 service 레이어 `canAccessCourse` + role 분기로 수행. 기존 materials/attendance/invites와 동일 패턴.

### 단계 9에서 다루지 않은 것 (후속 / 9B로 별도 추적)

- **자동 완료 cron** (`/api/cron/complete-courses`, api-spec §17) — 사용자 결정으로 보류. Vercel Cron / Supabase Edge Function 인프라 선택 후속.
- **참여 요청(Phase 8B) 이벤트** — `join_requested` / `join_approved` / `join_rejected` 로깅 추가 가능.
- **자료 확인 상태 변경** / **자료 삭제** 로그 — 운영자 액션이라 후순위.
- **"오늘 진행 회차" 합성 이벤트** — api-spec §16에서 언급된 derived item. 현재는 미포함.
- **읽음/안읽음** 상태 — MVP 범위 밖.

### 수업 정보 수정 UI (manage/courses 편집)

`/manage/courses` 목록에서 수업 행 끝 "편집" 버튼으로 진입하는 전용 페이지. api-spec.md §8.4 `updateCourse` 계약 정식화.

- **신규 페이지** [/manage/courses/[courseId]/edit/page.tsx](src/app/workspaces/[workspaceId]/(dashboard)/manage/courses/[courseId]/edit/page.tsx) + [edit-course-form.tsx](src/app/workspaces/[workspaceId]/(dashboard)/manage/courses/[courseId]/edit/edit-course-form.tsx) — 이름 / 운영 상태 / 연결 그룹(MultiSelect) / 담당 강사 / 카드 색상 / 배너 URL. 회차·참여자 배정은 폼에 노출 안 함.
- **`updateCourseAction` 확장** [src/services/courses.ts](src/services/courses.ts) — `groupIds` 변경 지원 + group_admin 권한 재검증. 그룹 제거 시 `course_participant_groups` 명시적 정리(이 테이블은 `groups`를 직접 참조하므로 `course_groups` 삭제 cascade로 자동 정리되지 않음). 참여자의 `course_participants.status`는 그대로 두고 그룹 0개 상태도 허용 — 사용자 결정.
- **신규 `getCourseEditData`** — 편집 폼이 한 번에 가져갈 수업 + 옵션 + `canManageFullCourse` 묶음.
- **목록에 편집 버튼** [courses-client.tsx](src/app/workspaces/[workspaceId]/(dashboard)/manage/courses/courses-client.tsx) — `canManageFullCourse=true`인 행만 노출.
- **validator** [course.ts](src/lib/validators/course.ts) `UpdateCourseSchema`에 `groupIds: z.array(uuid).min(1).optional()` 추가.
- 권한: owner_admin 또는 수업의 모든 연결 그룹이 본인 접근 범위 안인 group_admin만. 그 외엔 페이지 진입 시 거부 화면, 서버 액션은 `SCOPE_FORBIDDEN`.

### 멤버 정보 수정 다이얼로그 (members 페이지)

`/workspaces/[id]/members`에서 owner_admin이 멤버 행을 클릭하면 표시 이름·역할·상태·그룹 스코프·메모를 한 번에 수정하는 dialog가 뜬다. api-spec.md §6.3 `updateMember` 정식화.

- **신규 migration** [supabase/migrations/20260516010000_workspace_members_memo.sql](supabase/migrations/20260516010000_workspace_members_memo.sql) — `workspace_members.memo` 컬럼 추가(nullable text). `participants.memo`와 동일 패턴.
- **신규 validator** [UpdateMemberSchema](src/lib/validators/workspace-member.ts) — displayName / memo / role / status(active|disabled|removed) / groupIds. `invited`는 placeholder 상태라 dialog에서 변경 불가.
- **`getWorkspaceMembers` 확장** [src/services/workspace-members.ts](src/services/workspace-members.ts) — 반환 타입에 `memo`, `groupIds` 추가. `workspace_member_groups` 일괄 lookup으로 채움.
- **신규 `updateMember`** — Zod 검증 → owner_admin 권한 → 대상 조회 → **마지막 활성 owner_admin 보호**(역할/상태 변경 시 다른 active owner가 없으면 `CONFLICT`) → group 검증 → `workspace_members` patch → `workspace_member_groups` 동기화(role이 group_admin이 아닌 다른 값으로 바뀌면 기존 매핑 전부 삭제, group_admin이고 groupIds 명시되면 delete-then-insert). admin client 우회 유지.
- **신규 dialog** [edit-member-dialog.tsx](src/app/workspaces/[workspaceId]/(dashboard)/members/edit-member-dialog.tsx) — 이메일(읽기 전용), 표시 이름, 메모(500자 Textarea), 역할 Select, 상태 Select(invited는 disabled), group_admin일 때만 그룹 MultiSelect. 변경된 필드만 diff 후 전송. `removed`로 변경 시 confirm prompt.
- **목록 행 클릭** [members-client.tsx](src/app/workspaces/[workspaceId]/(dashboard)/members/members-client.tsx) — owner_admin이면 행 `cursor-pointer hover:bg-gray-50`, 클릭 시 dialog 오픈. 메모가 있는 멤버는 행에 `· 메모 있음` 작은 라벨 표시(전체 메모는 hover title로 노출).

### 캘린더 백엔드 연동 + 일반 일정 CRUD

`/workspaces/[id]/calendar` 페이지가 이전엔 mock 데이터로만 표시됐고 사이드 패널 일정 추가는 로컬 state에만 머물렀음. 이번 작업으로 실제 DB 연동 + 일반 일정 CRUD 정식화. api-spec.md §5.1, §5.2 구현.

- **`getCalendarMonth` 재작성** [src/services/calendar.ts](src/services/calendar.ts):
  - `course_sessions` 월 범위 조회 + `courses`/`course_groups`/instructor `workspace_members` join
  - `general_schedule_items` + `general_schedule_item_groups` join (RLS가 owner/접근 그룹 매핑 자동 필터)
  - 권한 필터: owner_admin은 전체 통과, group_admin은 수업 연결 그룹이 본인 `accessible_group_ids`와 교집합 있는 회차만
  - `canUpdateSessionDisplay`/`canEdit`/`canDelete` 계산
  - 반환 타입을 `ApiResult<GetCalendarMonthOutput>`으로 변경 — caller(page.tsx) 함께 갱신
- **신규 `upsertGeneralScheduleItem` / `deleteGeneralScheduleItem`** — Zod 검증 → role 확인 → group_admin이면 접근 그룹 범위 검증 → admin client로 `general_schedule_items` + `general_schedule_item_groups` 다대다 동기화(delete-then-insert). 삭제는 owner_admin 또는 `created_by=본인`만 가능, FK cascade로 그룹 매핑 자동 정리.
- **신규 validator** [src/lib/validators/schedule.ts](src/lib/validators/schedule.ts) `UpsertGeneralScheduleItemSchema` — title/date/시간/그룹. `endsAt`이 있으면 `startsAt`도 필수 + `endsAt > startsAt` 강제. 그룹 ≥ 1.
- **page.tsx** — `getCalendarMonth` + `getGroupsPage`(활성 그룹) + `getWorkspaceContext` 병렬 로드. instructor 권한 차단(URL 직접 접근 → 홈으로 redirect).
- **calendar-client.tsx** — 로컬 state 기반 낙관적 갱신 제거, SSR `router.refresh()` 의존으로 단순화. props에 `groupOptions: GroupSummary[]` 추가.
- **schedule-side-panel.tsx 재작성** — hardcoded `group-001`/`group-002` 제거 → `MultiSelect`로 실제 그룹 옵션 노출. 서버 액션 호출, 입력 검증, 실패 시 inline error + toast. 회차 항목의 trash 버튼은 숨김(기존 버그 수정 — 회차는 calendar에서 삭제할 수 없음). 일반 일정 삭제 시 confirm prompt.

#### 단계 캘린더 RLS / 스펙 충돌 (보고 사항)

- `general_schedule_items` / `general_schedule_item_groups` INSERT/UPDATE/DELETE를 admin client 우회. 권한은 service 레이어에서 owner_admin / created_by=본인 / group_admin 접근 그룹 교차로 검증.
- `course_sessions`/`courses`/`course_groups`/`workspace_members` SELECT는 admin client 사용 — 그룹 정보를 일관 조회하기 위함(SSR에서 RLS 정책 분기 회피).

#### 이번 plan 범위 밖 (후속)

- **일반 일정 편집 UI** — service `upsert`는 id 처리 지원, 사이드 패널 아이템 클릭 시 dialog로 수정 화면 추가 가능.
- **회차 상태 변경(api-spec §5.3)** — 회차 칩 클릭 → 가시성/집계/진행 상태 토글.
- **그룹 필터 select** — 상단에서 그룹 골라 좁히기 (URL `?groupId=` 동기화).
- **색상 선택** — 현재 모든 일반 일정 color는 `#F97316` 고정. ColorPicker 재사용 검토.
- **Google Calendar 양방향 sync** — 연동 시점에 `general_schedule_items`에 `external_source`/`external_id` 컬럼 migration으로 추가.

### 자주 발생하는 환경 이슈

**`"No suitable key or wrong key type"`**: admin 호출(강사 초대 `listUsers`, 자료 storage upload 등)에서 동시에 발생하면 거의 항상 `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY` 문제다. `supabase status` 출력과 비교해 정확히 매핑되어 있는지(특히 anon key와 혼동 여부) 확인하고 dev server를 재시작한다.

### 단계 6/7에서 다루지 않은 것

- **AuditLog 연동:** 자료/출석/메모 이벤트의 `activity_logs` 채움은 단계 9에서 일괄 처리.
- **자료 미리보기:** MVP 외.
- **자료 일괄 작업:** MVP 외.
- **운영자용 출석부 진입점:** api-spec §15에서 운영자도 같은 계약을 호출 가능하지만 운영자 콘솔에 출석부 탭이 없음. 후속 작업.
- **출석 카운트 가중치 안내:** UI에서 `partial × 0.5` 가중치를 사용자에게 별도 안내하지 않음.
- **만료/실패 업로드 정리:** 단계 9 cron에서 처리(이제 흐름이 단일 server action이라 고아 row 가능성이 매우 낮음 — 단계별 best-effort 롤백 포함).

## 작업 시 참고

- 페이지는 `services/`의 query/action을 호출(직접 Supabase 호출 금지) — [AGENTS.md §6](AGENTS.md).
- `workspaceId`는 모든 업무 데이터 요청 입력에 포함.
- `can*` boolean은 화면 제어용. 서버에서 권한을 다시 계산.
- 라벨은 [lib/api/labels.ts](src/lib/api/labels.ts)를 통해 변환.
- **admin client 우회 패턴**: `materials` INSERT/UPDATE/DELETE/storage, `material_groups` INSERT/DELETE, `attendance_records`/`class_memos` upsert, `workspace_members` INSERT/UPDATE, `invites`/`invite_groups`/`invite_courses`(단계 8), `workspace_join_requests` INSERT/UPDATE(단계 8B), `activity_logs` INSERT/SELECT(단계 9). 새 RLS 패턴에서 같은 에러가 보이면 같은 방식 적용 + 보고 사항으로 README에 기록.
- UI는 [Figma 디자인](https://www.figma.com/design/44LjDxyubV8Q9B53WBMzSr/DURE) 기준.
