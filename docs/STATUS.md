# Project Status

최종 갱신: 2026-07-25

## 현재 상태

대표 운영자용 Admin Copilot deterministic MVP가 `feat/admin-copilot-prd` branch에 구현되어 있습니다. Supabase 운영 데이터를 permission-scoped service에서 집계하고, 네 가지 명시적 규칙으로 evidence-backed task를 생성하여 workspace home에 읽기 전용 briefing으로 표시합니다. AI provider, 자연어 후속 질문, action 실행은 아직 구현하지 않았습니다. 현재 branch에 연결된 Pull Request는 없습니다.

## 최근 검증

2026-07-25에 다음을 실행했습니다.

```bash
npm run test:admin-copilot
npm run typecheck
npm run lint
npm run build
```

결과:

- Admin Copilot logic test: 5 passed
- TypeScript typecheck: passed
- Next.js lint: passed with existing warnings 3건
- Next.js production build: passed
- 기존 warning 3건: unused import 1건, `<img>` optimization warning 2건

## 지금 시작할 곳

Admin Copilot의 출석 위험 대상 범위를 DURE의 표준 group-derived 참여자 projection과 일치시킨 뒤, 실제 owner-admin workspace 데이터로 네 가지 task signal, empty state, evidence link, non-owner exclusion을 수동 QA합니다.

## Blocker / 미검증

- 실제 Supabase workspace를 사용한 owner-admin manual QA는 이 상태 문서 갱신 시점에 수행하지 않았습니다.
- production deployment와 deployed URL runtime은 이 상태 문서 갱신 시점에 확인하지 않았습니다.
- 현재 출석 위험 계산은 `course_participants.status='active'` row가 있는 참여자만 대상으로 삼습니다. DURE의 표준 수업 참여자 범위는 `course_groups`와 활성 `participant_groups`에서 파생하고 `course_participants.status='excluded'`만 제외하므로, 자동 참여자 누락 가능성을 수정하고 service/integration test로 검증해야 합니다.
- 현재 자동 테스트는 순수 규칙 로직 중심입니다. 실제 Supabase query, 멤버십 권한, home 통합을 포함하는 service/integration test는 없습니다.
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
