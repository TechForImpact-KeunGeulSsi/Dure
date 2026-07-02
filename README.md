# DURE

DURE는 여러 운영 단위의 수업, 참여자, 강사, 일정, 자료, 출석 기록을 한 워크스페이스 안에서 관리하는 웹 서비스입니다.

이 레포는 제품 개발의 기준이 되는 마스터 레포입니다. 실행 가능한 앱 코드, Supabase migration, 현재 기준 문서만 루트와 `docs/`에 두고, 발표 자료와 과거 단계 산출물은 `docs/archive/`에 보관합니다.

## 핵심 문서

- [작업 지침](AGENTS.md)
- [용어 기준](docs/context.md)
- [시스템 구조](docs/architecture.md)
- [페이지별 query/action 계약](docs/api-spec.md)
- [로컬 셋업](docs/setup.md)
- [Supabase 기준](supabase/README.md)

보관용 자료:

- `docs/archive/phase-history/` — 과거 PRD, 환경 문서, 단계별 설계 문서
- `docs/archive/presentation/` — 발표 HTML과 시연 자산
- `docs/archive/superpowers/` — 과거 brainstorm/spec/mockup 산출물
- `docs/archive/user-testing/` — 특정 테스트 배포와 Google Form 운영 가이드
- `docs/archive/reference-data/` — 유저 테스트나 기초 데이터 추출 자료

## 기술 스택

- Next.js 15 App Router, React 19, TypeScript
- Tailwind CSS v4
- Supabase Auth, PostgreSQL, Storage
- Zod, date-fns

## 주요 디렉터리

```text
src/
  app/                # Next.js routes, server components, route handlers
  components/         # UI and domain components
  lib/                # Supabase clients, validators, shared helpers
  services/           # Server-side domain queries/actions
  types/              # Shared TypeScript types
supabase/
  migrations/         # DB schema and policy history
  config.toml         # Local Supabase config
docs/
  context.md
  architecture.md
  api-spec.md
  setup.md
  archive/
```

## 로컬 실행

```bash
npm install
cp .env.example .env.local
supabase start
supabase db reset
npm run dev
```

환경 변수 매핑과 Supabase 로컬 URL은 [docs/setup.md](docs/setup.md)를 따릅니다.

## 개발 명령

```bash
npm run dev
npm run typecheck
npm run build
```

현재 `npm run lint`는 `next lint`를 호출합니다. Next.js 15 환경에서는 별도 ESLint 실행 방식으로 갱신이 필요할 수 있습니다.

## 현재 제품 범위

구현된 주요 범위:

- 워크스페이스 생성과 멤버십
- 그룹, 참여자, 수업, 반복 회차
- 운영자 대시보드, 캘린더, 수업 상세
- 자료 업로드와 공개 범위, 자료 확인 상태
- 강사 콘솔, 출석부, 수업 메모
- 멤버 초대와 매직 링크 수락
- 워크스페이스 참여 요청
- 헤더 최근 활동
- 공개 수업 카탈로그와 공개 preview

새 기능을 추가할 때는 `docs/context.md`, `docs/architecture.md`, `docs/api-spec.md`를 먼저 확인하고, 페이지에서는 `services/` 계층을 통해 데이터에 접근합니다.
