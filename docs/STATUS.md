# Project Status

최종 갱신: 2026-07-24

## 현재 상태

대표 운영자용 Admin Copilot deterministic MVP가 `feat/admin-copilot-prd` branch에 구현되어 있습니다. Supabase 운영 데이터를 permission-scoped service에서 집계하고, 네 가지 명시적 규칙으로 evidence-backed task를 생성하여 workspace home에 읽기 전용 briefing으로 표시합니다. AI provider와 LLM phrasing은 의도적으로 범위에서 제외되어 있습니다.

## 최근 검증

2026-07-24에 다음을 실행했습니다.

```bash
npm run test:admin-copilot
npm run typecheck
npm run build
```

결과:

- Admin Copilot logic test: 5 passed
- TypeScript typecheck: passed
- Next.js production build: passed
- 기존 lint warning 3건이 build 중 출력됨: unused import 1건, `<img>` optimization warning 2건

## 지금 시작할 곳

실제 owner-admin workspace 데이터로 네 가지 task signal, empty state, evidence link, non-owner exclusion을 수동 QA합니다.

## Blocker / 미검증

- 실제 Supabase workspace를 사용한 owner-admin manual QA는 이 상태 문서 갱신 시점에 수행하지 않았습니다.
- production deployment와 deployed URL runtime은 이 상태 문서 갱신 시점에 확인하지 않았습니다.
- LLM phrasing을 추가하려면 provider, 비용, permission-filtered input contract를 먼저 결정해야 합니다.

## 기준 문서

- Agent 작업 규칙: `AGENTS.md`
- 용어: `docs/context.md`
- 구조: `docs/architecture.md`
- API와 화면 계약: `docs/api-spec.md`
- Admin Copilot 범위: `docs/admin-copilot-prd.md`
- 구현 세부: `docs/admin-copilot-implementation-plan.md`

## 상태 관리 원칙

- 현재 작업 상태, 검증, blocker, 다음 시작점은 이 파일에서만 관리합니다.
- 실제 코드와 테스트 결과가 이 문서보다 우선합니다.
- 개인 학습 상태는 repository가 아니라 Knowledge Debt Vault의 `DURE/learning.md`에서 관리합니다.
