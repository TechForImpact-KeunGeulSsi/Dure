# DURE

DURE는 교육·돌봄·문화예술 프로그램을 운영하는 조직이 수업 운영 정보를 한 곳에서 관리하도록 돕는 웹 서비스입니다. 그룹, 수업, 회차, 참여자, 강사, 일정, 자료, 출석, 수업 메모와 피드백을 하나의 워크스페이스로 연결합니다.

현장 운영에서는 모집·반 배정·일정·출석·기록·보고가 종이, 스프레드시트와 메신저로 나뉘기 쉽습니다. DURE는 운영자의 판단을 대신하기보다, 한 번 입력한 정보를 역할별 화면과 후속 업무에서 안전하게 재사용하도록 만드는 것을 목표로 합니다.

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
```

## 로컬 실행

```bash
npm install
cp .env.example .env.local
supabase start
supabase db reset
npm run dev:local
```

환경 변수는 `.env.example`을 기준으로 설정합니다. 실제 비밀값은 커밋하지 않습니다.

## 개발 명령

```bash
npm run dev:local
npm run dev
npm run test:admin-copilot
npm run lint
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
- 대표 운영자용 Admin Copilot 운영 브리핑(네 가지 결정론적 신호, 근거, 관련 화면 링크)
- `PendingMaterialReview` 자료를 위한 `proposal → 사람의 승인/거절 → 실행 기록` 흐름

## AI 에이전트를 위한 사전 작업

현재 DURE에는 LLM이나 외부 AI provider를 연결하지 않았습니다. 먼저 운영 ontology를 정리하고, 운영 객체·관계·source table/column·역할별 조회 범위·action 권한·evidence를 문서와 코드에 연결했습니다. 또한 `권한 확인 → source 재조회 → 결정론적 규칙 → 근거 생성 → 관련 화면` 경로와 제안·사람 승인·실행·idempotency·stale expiry·audit 경계를 고정했습니다.

따라서 이 저장소의 AI 준비는 자율 에이전트 완성본이 아니라, 향후 AI 기능을 연결해도 권한과 근거를 잃지 않게 하는 운영 데이터·action 기반을 뜻합니다. Admin Copilot의 네 신호는 결정론적 규칙으로 계산하며, 일반 브리핑 조회는 읽기 전용입니다. 자료 검토만 별도의 `ReviewMaterial` action 경계를 통해 명시적 owner 승인 후 실행됩니다.

## 공개 범위와 현재 한계

이 저장소는 외부 검토를 위해 실행 가능한 제품 코드, DB migration/config, 현재 시스템 문서, 테스트와 이 README를 공개합니다. 기관 연락처, 개인 식별 정보, 녹음·녹취 원본, 실제 출석부·스프레드시트, 미팅 링크와 내부 진행 기록은 포함하지 않습니다.

현재 DURE에는 LLM이나 외부 AI provider가 연결되어 있지 않습니다. Admin Copilot은 결정론적 규칙으로 운영 신호와 근거를 생성하며, 자료 검토는 `제안 → 사람의 승인/거절 → 실행 기록` 경계를 따릅니다. 향후 AI 기능을 연결하더라도 권한 확인, 원본 재조회, 근거 생성, 사람 승인 범위를 유지하는 것이 현재 구현의 기준입니다.

아직 LLM 기반 자연어 후속 질문과 자율 실행은 구현하지 않았습니다. 실제 기관 데이터와의 대조, 원격 migration/runtime, 인증된 브라우저 전체 시나리오는 배포 환경에서 별도 검증이 필요합니다.
