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
| 2 | 워크스페이스 생성과 멤버십 모델 구현 | ✅ 완료 (이번 작업) |
| 3 | 그룹, 참여자, 그룹 배정 CRUD 구현 | ⏳ 대기 |
| 4 | 수업 생성, 반복 회차 생성, 수업-참여자 배정 구현 | ⏳ 대기 |
| 5 | 운영자용 수업 목록/상세와 캘린더 구현 | ⏳ 대기 |
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

## 작업 시 참고

- 페이지는 Supabase 업무 테이블을 직접 호출하지 않고 `services/`의 query/action을 호출한다 ([AGENTS.md §6](AGENTS.md)).
- `workspaceId`는 모든 업무 데이터 요청 입력에 포함한다.
- `can*` boolean은 화면 제어용 보조 값이며 서버에서 권한을 다시 계산한다.
- 라벨은 [lib/api/labels.ts](lib/api/labels.ts)를 통해 변환하고, enum 값을 직접 표시하지 않는다.
- UI는 [Figma 디자인](https://www.figma.com/design/44LjDxyubV8Q9B53WBMzSr/DURE)을 기준으로 한다. Figma MCP가 `.mcp.json`에 설정되어 있다.
