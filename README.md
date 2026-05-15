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

architecture.md §3을 그대로 따른다.

- **Frontend/Backend**: Next.js 15 App Router + React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Auth/DB/Storage**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **검증**: Zod
- **날짜**: date-fns

## 디렉토리

```
app/
  layout.tsx                 # 루트 레이아웃 (한글 폰트, Toaster)
  page.tsx                   # 로그인 여부에 따라 /login 또는 /workspaces로 redirect
  globals.css                # Tailwind v4 + 디자인 토큰
  (auth)/
    login/                   # Supabase OTP/매직 링크 로그인
    accept-invite/           # ?token=... 초대 수락
  auth/callback/             # 매직 링크 코드 교환 Route Handler
  workspaces/
    page.tsx                 # 0개면 new로, 1개면 자동 진입, 2개+면 선택
    new/                     # 워크스페이스 생성 폼
    [workspaceId]/
      (dashboard)/
        layout.tsx           # getWorkspaceContext 게이트 + 사이드바/헤더
        home/                # MVP 빈 상태
  api/invites/[token]/accept/route.ts
components/layout/           # sidebar, header
lib/
  supabase/{client,server,admin}.ts
  auth/{require-user,require-workspace-role}.ts
  api/{types,errors,labels}.ts        # api-spec.md §1, §2 미러
  validators/                # Zod 스키마
  utils/cn.ts
services/                    # 페이지가 호출하는 query/action 구현체
  workspaces.ts              # listMyWorkspaces, createWorkspaceAction, getWorkspaceContext
  invites.ts                 # acceptInvite
middleware.ts                # Supabase SSR 세션 갱신
supabase/                    # DB migration (자세한 내용은 supabase/README.md)
```

## 로컬 셋업

자세한 환경 변수와 Supabase 셋업은 [docs/environment.md](docs/environment.md)를 따른다.

1. **Docker Desktop**을 켠다.
2. **Supabase CLI**를 설치한다. (`scoop install supabase` 또는 [공식 가이드](https://supabase.com/docs/guides/cli))
3. 로컬 Supabase를 띄운다.
   ```bash
   supabase login
   supabase link --project-ref oyoexxqaeayaksfoixxr
   supabase db reset
   ```
4. 환경 변수를 채운다.
   ```bash
   cp .env.example .env.local
   supabase status   # 출력된 anon key, service role key, JWT secret을 .env.local에 옮김
   ```
5. 의존성 설치 및 개발 서버 실행.
   ```bash
   npm install
   npm run dev
   ```
   - 앱: http://localhost:3000
   - Supabase Studio: http://127.0.0.1:54323
   - 매직 링크 메일(Inbucket): http://127.0.0.1:54324

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | Next.js 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## 진행 상황

architecture.md §14의 MVP 구현 순서를 기준으로 추적한다.

| # | 단계 | 상태 |
| --- | --- | --- |
| 1 | Supabase 프로젝트, Auth, 기본 DB migration, RLS helper function 구성 | ✅ 완료 ([supabase/migrations/20260512163305_initial_schema.sql](supabase/migrations/20260512163305_initial_schema.sql) — 43 테이블, 18 enum, RLS helper 8종, `create_workspace` RPC, 마지막 owner 보호 트리거, `course-materials` Storage 버킷) |
| 2 | 워크스페이스 생성과 멤버십 모델 구현 | ✅ 완료 |
| 3 | 그룹, 참여자, 그룹 배정 CRUD 구현 | ✅ 완료 |
| 4 | 수업 생성, 반복 회차 생성, 수업-참여자 배정 구현 | ✅ 완료 (이번 작업) |
| 5 | 운영자용 수업 목록/상세와 캘린더 구현 | 구현중... |
| 6 | 자료 업로드, 공개 그룹, 확인 상태 구현 | ⏳ 대기 |
| 7 | 강사 콘솔의 자료, 출석부, 수업 메모 구현 | ⏳ 대기 |
| 8 | 사용자 초대/권한 설정 구현 | ⏳ 부분 (초대 수락 흐름만 완료, 발급 UI/액션은 대기) |
| 9 | 헤더 최근 활동과 자동 완료 cron 구현 | ⏳ 대기 (헤더 자리는 있고 빈 상태 드롭다운만 노출) |

### 단계 2에서 구현한 것

- Next.js 프로젝트 부트스트랩(설정 파일 + 루트 레이아웃 + 디자인 토큰).
- Supabase 클라이언트 3종(`client`, `server`, `admin`)과 SSR 미들웨어.
- api-spec.md §1.6 enum, §2 DTO, §1.3~§1.4 `ApiResult`/`ApiError`/`ApiErrorCode`를 TypeScript로 옮긴 공통 모듈.
- 인증 게이트 `requireUser`, `requireWorkspaceMembership`.
- Supabase OTP/매직 링크 로그인 + 콜백.
- 워크스페이스 생성/선택 화면과 서버 액션(`create_workspace` RPC 호출).
- `getWorkspaceContext` (api-spec.md §3.1) 기반 대시보드 레이아웃 + capabilities로 메뉴 가시성 제어.
- 초대 수락 흐름(`POST /api/invites/[token]/accept`)과 안내 화면. token은 sha256 hex로 비교.

### 단계 2에서 구현하지 않은 것

- 그룹/수업/참여자/자료/출석/일정 CRUD — 단계 3 이후.
- 초대 링크 발급 UI와 `createInvite` 액션 — 단계 8에서 처리.
- 최근 활동 데이터 로딩 — 단계 9에서 처리. 지금은 빈 드롭다운만.
- 강사 콘솔 — 단계 7.

### 단계 3에서 구현한 것

- 관리 허브 레이아웃과 탭 네비(그룹/수업/참여자) — `/manage`는 `/manage/groups`로 자동 redirect, 수업 탭은 단계 4 placeholder.
- 그룹 CRUD: 목록(검색·상태 필터·페이지네이션) + 생성/수정/소프트 삭제. 대표 운영자는 전체 필드, 그룹 운영자는 접근 그룹 description만 수정(`accessible_group_ids` RPC로 사전 검증 후 admin client로 우회 — RLS 스펙 충돌 처리).
- 참여자 CRUD: 목록(검색·그룹·상태 필터·페이지네이션) + 생성/수정/소프트 삭제/그룹 배정 변경. 그룹 운영자는 자기 접근 그룹 범위에서만 동작.
- 공통 UI 프리미티브 12종: Button, Input, Textarea, Label, Select, Dialog, Table, Tabs, Badge, StatusBadge(그룹/참여자/멤버), Pagination, EmptyState, MultiSelect.
- 라벨 함수 추가: `groupStatusLabel`, `participantStatusLabel`.

### 단계 3 RLS / 스펙 충돌 (보고 사항 — AGENTS.md §2)

api-spec.md §7.2는 그룹 운영자의 description 수정을 허용하지만, 현재 migration의 `owners can manage groups` 정책은 owner만 write 가능. 임시 처리: [services/groups.ts](services/groups.ts)의 `updateGroupDescriptionAsGroupAdmin`에서 `accessible_group_ids` RPC로 접근 권한을 사전 검증한 뒤 admin client(service role)로 description만 갱신. 다른 필드 변경은 ROLE_FORBIDDEN. 후속으로 마이그레이션을 추가해 정책을 완화하면 admin client 우회를 제거할 수 있다.

### 단계 4에서 구현한 것

- 수업 목록 페이지([app/.../manage/courses/page.tsx](app/workspaces/[workspaceId]/(dashboard)/manage/courses/page.tsx) + [courses-client.tsx](app/workspaces/[workspaceId]/(dashboard)/manage/courses/courses-client.tsx)) — Phase 4 placeholder 교체. 통계 카드(전체/진행중/완료), 검색·그룹·상태 필터, 표(이름/연결 그룹/담당자/참여자 수/회차 수/상태), 페이지네이션.
- 수업 생성 페이지([app/.../manage/courses/new/page.tsx](app/workspaces/[workspaceId]/(dashboard)/manage/courses/new/page.tsx) + [new-course-form.tsx](app/workspaces/[workspaceId]/(dashboard)/manage/courses/new/new-course-form.tsx)) — 단일 페이지 섹션 폼. 기본 정보 / 반복 회차(요일·시간·종료 조건 + 실시간 회차 미리보기) / 참여자 배정(그룹 선택 시 자동 후보 로딩 + 수업 내 참여 그룹 토글).
- 회차 계산 유틸 [lib/courses/recurrence.ts](lib/courses/recurrence.ts) — `planSessions({startsOn, endsOn|sessionCount, repeatWeekdays, startsAt, endsAt})` → `SessionPlan[]`. date-fns 사용. Sunday=0 컨벤션. 클라이언트 미리보기와 서버 insert가 같은 함수를 공유.
- 서비스 [services/courses.ts](services/courses.ts) — api-spec.md §8 계약 5종(`getCoursesPage`, `getCourseFormOptions`, `createCourseAction`, `updateCourseAction`, `updateCourseParticipantAssignmentAction`). 생성은 sequential insert(courses → recurrence → groups → sessions → participants → participant_groups) + 단계 실패 시 courses 삭제로 best-effort 트랜잭션.
- Zod 스키마 [lib/validators/course.ts](lib/validators/course.ts) — 회차 규칙(종료일 xor 회차 수), 시간 정합성, 카드 색상 형식 모두 검증.
- 도메인 컴포넌트 [components/courses/](components/courses/) — CourseCard(홈/목록 공통), WeekdayPicker, ColorPicker(6색 팔레트).
- 헤더 "+ 수업 만들기" 버튼([components/layout/header.tsx](components/layout/header.tsx)) — 운영자(owner/group)에게만 노출, 모든 대시보드 화면에서 접근.
- 홈 화면([app/.../home/page.tsx](app/workspaces/[workspaceId]/(dashboard)/home/page.tsx)) — `getCoursesPage`로 수업을 불러와 Figma 2:3 카드 디자인으로 표시. 진행 중 → 진행 전 → 진행 완료 순 정렬. 마지막 셀에 "수업 추가" 카드 유지.
- `CourseStatusBadge` 추가 — [components/ui/status-badge.tsx](components/ui/status-badge.tsx).

### 단계 4에서 다루지 않은 것

- 수업 상세 페이지(수업 홈, 수업 자료, 참여자 현황 탭) — 단계 5/6/7.
- 수업 수정/삭제 UI — 단계 5.
- 회차 재생성(반복 규칙 변경) — 단계 5.
- 캘린더 화면 — 단계 5.
- Supabase JS 트랜잭션 부재로 인한 race condition(아주 드묾) — 후속 RPC 묶음으로 개선 가능.

### 단계 5에서 구현한 것 (Phase 5)
* **홈 화면 피드백 반영:** 수업 추가 버튼 좌측 상단 배치 및 상태별(진행 전/중/완료) 필터 적용.
* **운영자용 수업 상세 뼈대 구축 (`/courses/[id]/home` 등):** 수업 컨텍스트 로드 및 3개 탭(수업 홈, 수업 자료, 참여자 현황) 라우팅 연결.
* **수업 홈 구현:** 상단 배너 커스텀 진입점, 수업 정보 요약 카드, 그리고 하단 회차 목록 표(노출/집계/진행 토글 UI) 구현.
* **참여자 현황 구현:** 통계 카드 UI, 상태/출석 필터, 참여자 목록 및 추가/제외 모달 뼈대 구현.
* **월간 캘린더 화면 (`/calendar`):** `date-fns`를 활용한 6주 그리드 구성, 날짜별 수업 회차/일반 일정 칩 렌더링, 일정 추가 및 선택 날짜 목록 사이드 패널 구현.
* **Mock Data 연동:** 백엔드 연동 전 화면 렌더링을 위해 `api-spec.md`에 명시된 규격대로 임시 데이터를 생성하여 UI 연결 완료.

### 단계 5에서 다루지 않은 것
* **수업 자료 탭 구현:** Phase 6에서 진행할 예정이므로 EmptyState로 처리함.

## 작업 시 참고

- 페이지는 Supabase 업무 테이블을 직접 호출하지 않고 `services/`의 query/action을 호출한다 ([AGENTS.md §6](AGENTS.md)).
- `workspaceId`는 모든 업무 데이터 요청 입력에 포함한다.
- `can*` boolean은 화면 제어용 보조 값이며 서버에서 권한을 다시 계산한다.
- 라벨은 [lib/api/labels.ts](lib/api/labels.ts)를 통해 변환하고, enum 값을 직접 표시하지 않는다.
- UI는 [Figma 디자인](https://www.figma.com/design/44LjDxyubV8Q9B53WBMzSr/DURE)을 기준으로 한다. Figma MCP가 `.mcp.json`에 설정되어 있다.
