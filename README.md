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
| 8 | 사용자 초대/권한 설정 정식화(그룹 운영자 초대, 매직 링크 발급) | 구현중 - 박수현 |
| 9 | 헤더 최근 활동과 자동 완료 cron | ⏳ 대기 |

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
- **admin client 우회 패턴**: `materials` INSERT/UPDATE/DELETE/storage, `material_groups` INSERT/DELETE, `attendance_records`/`class_memos` upsert, `workspace_members` INSERT(강사 초대). 새 RLS 패턴에서 같은 에러가 보이면 같은 방식 적용 + 보고 사항으로 README에 기록.
- UI는 [Figma 디자인](https://www.figma.com/design/44LjDxyubV8Q9B53WBMzSr/DURE) 기준.
