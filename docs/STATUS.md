# Project Status

최종 갱신: 2026-08-05

## 현재 상태

대표 운영자용 Admin Copilot deterministic MVP가 `feat/admin-copilot-prd` branch에 구현되어 있습니다. Supabase 운영 데이터를 permission-scoped service에서 집계하고, 네 가지 명시적 규칙으로 evidence-backed task를 생성하여 workspace home에 읽기 전용 briefing으로 표시합니다. 출석 위험 대상은 표준 group-derived 참여자 projection과 일치하며, owner admin이 관련 참여자 현황 화면으로 이동할 수 있습니다. AI provider, 자연어 후속 질문, action 실행은 아직 구현하지 않았습니다. 현재 branch에 연결된 Pull Request는 없습니다.

기존 Darori 사용자 테스트 seed와 분리된 local-first developer QA smoke fixture가 추가되었습니다. 고정 로컬 workspace, 3개 역할 계정, 주요 steady-state 운영 데이터, Admin Copilot 네 신호를 Seoul 기준 날짜로 복원하며, schema/Storage/workspace identity preflight와 DB/Auth/Storage/RLS/결정론적 briefing verifier를 제공합니다. Owner, group admin, instructor, public surface의 로컬 브라우저 smoke와 mutation 검증을 완료했고 fixture를 baseline으로 복원했습니다. 원격 staging은 배포 단계의 선택 사항입니다.

다음 제품 방향은 Supabase를 source of truth로 유지하면서 semantic object/link/function과 kinetic action/policy/audit를 결합한 operational ontology layer를 추가하는 것입니다. 첫 vertical slice는 `PendingMaterialReview -> ReviewMaterial proposal -> owner_admin human approval -> reviewed`입니다. Task 1 DB foundation migration이 추가되어 proposal/execution enum과 tenant-scoped ledger, owner-only read RLS, service-role 전용 승인/거절 RPC, stale expiry, atomic `pending -> reviewed`, idempotency, before/after audit 계약을 고정했습니다. Proposal service, action orchestration, 승인 UI는 아직 구현되지 않았습니다. `Material.review_status`는 `pending | reviewed` 두 상태를 유지하고, 제안 거절과 실행 결과는 별도 proposal/execution lifecycle에 기록합니다.

Operational Ontology v1 공통 계약은 `docs/ontology-contract.md`에 구현했습니다. 현재 ontology의 11개 객체와 네 Admin Copilot task에 대해 source table·column, 양방향 cardinality, 관계 예외, 역할별 read/action scope, `권한 gate -> source query -> deterministic rule -> evidence -> 관련 화면` 경로를 고정했습니다. 이 변경은 문서와 drift 검증을 추가한 것이며 DB schema, runtime service, RLS, UI 동작은 변경하지 않았습니다.

## 최근 검증

2026-07-25에 다음을 실행했습니다.

```bash
npm run test:admin-copilot
npm run typecheck
npm run lint
npm run build
```

결과:

- Admin Copilot logic/projection test: 12 passed
- TypeScript typecheck: passed
- Next.js lint: passed with existing warnings 3건
- Next.js production build: passed
- 기존 warning 3건: unused import 1건, `<img>` optimization warning 2건

2026-07-26 developer QA fixture 로컬 검증:

- `npm run test:developer-qa`: 3 passed
- `npm run test:darori-seed`: 3 passed
- `npm run test:admin-copilot`: 12 passed
- 신규 `.mjs` syntax check: passed
- `npm run typecheck`: passed
- `npm run lint`: passed with existing warnings 3건
- `npm run build`: passed with the same existing warnings 3건
- `npm run seed:developer-qa:local -- --dry-run`: local preflight passed
- `npm run seed:developer-qa:local -- --reset`: 연속 2회 reset + verifier passed
- `npm run verify:developer-qa:local`: passed
- `npm run dev:local`: local Supabase 연결로 Next.js ready 확인
- 로컬 앱 owner 계정 로그인, 고정 QA workspace home, 수업 6개, Admin Copilot 네 task/count 렌더링 확인

2026-08-02 developer QA 최종 로컬 검증:

- Owner: workspace 전체 수업 6개, 그룹 4개, 참여자 8명, 멤버 3명, 일정, 자료, 의견, 정산 화면을 확인했고 Admin Copilot이 owner에게만 표시됨을 확인
- Group admin: Alpha 범위 수업 3개와 at-least-one-accessible-group 정책을 확인하고 그룹 설명 수정을 저장; Beta/Gamma-only 범위와 Admin Copilot은 미노출
- Instructor: 배정 수업 3개와 홈·자료·출석·메모·정산을 확인하고 출석 메모, 수업 메모, 계좌 정보를 저장; 미배정 수업 직접 접근은 404, Admin Copilot은 미노출
- Public: 공개 QA 수업 5개, hidden 수업 미노출, 공개 자료 다운로드를 확인하고 `QA 공개 사용자` 의견을 제출
- Public 의견이 owner 의견 수렴 화면과 Admin Copilot 신규 피드백 task에 표시됨을 확인하고, owner UI에서 `미확인 -> 확인됨` mutation을 수행한 뒤 task 해소를 확인
- Copilot evidence link: pending material은 해당 자료 화면, attendance risk는 김위험이 표시된 참여자 현황, new feedback은 신규 의견 화면, completion candidate는 해당 수업 편집 화면으로 이동; 404·권한 오류·잘못된 대상 없음
- Owner 자료 다운로드, 공개 자료 다운로드, 정산 상세와 영수증 다운로드 경로 확인
- 의견 수렴 화면의 Node/browser locale·timezone 차이로 발생한 hydration mismatch를 재현하고 workspace timezone과 24시간 표기를 명시하도록 수정; 자동 회귀 테스트와 실제 브라우저에서 issue overlay·console error 없이 렌더링됨을 재검증
- `npm run seed:developer-qa:local -- --reset`: reset + verifier passed
- `npm run verify:developer-qa:local`: expected/actual 일치, passed
- `npm run test:developer-qa`: 3 passed
- `npm run test:feedback-date-format`: 1 passed
- `npm run test:admin-copilot`: 12 passed
- `npm run test:darori-seed`: 3 passed
- `npm run lint`: passed with existing warnings 3건
- `npm run typecheck`: passed
- `npm run build`: passed with the same existing warnings 3건

2026-08-02 Operational Ontology 공통 계약 검증:

- `npm run test:ontology-contract`: 3 passed
- `npm run test:admin-copilot`: 12 passed
- `npm run typecheck`: passed
- `npm run lint`: passed with existing warnings 3건
- `npm run build`: passed with the same existing warnings 3건
- `git diff --check`: passed

2026-08-05 ReviewMaterial Task 1 검증:

- `npm run test:ontology-action-migration`: 3 passed
- 현재 branch의 migration 전체를 격리된 local PostgreSQL DB에 순서대로 적용: passed
- `scripts/ontology-action-review-material.contract.sql`: approval, replay, rejection, stale expiry, before/after audit, owner/non-owner RLS smoke passed; transaction rollback 후 임시 DB 삭제
- `npm run test:ontology-contract`: 3 passed
- `npm run test:admin-copilot`: 12 passed
- `npm run test:developer-qa`: 3 passed
- `npm run typecheck`: passed
- `npm run lint`: passed with existing warnings 3건
- `npm run build`: passed with the same existing warnings 3건
- `git diff --check`: passed

2026-08-05 ReviewMaterial Task 2 검증:

- `src/services/ontology-action-contract.ts`에 `ReviewMaterial` action 상수·버전, canonical target version, tenant/action/target/version 기반 SHA-256 fingerprint, proposal evidence builder, proposal·transition validation을 구현
- 동일한 object version의 fingerprint 재현, equivalent timezone 표기 정규화, `updated_at` 변경 fingerprint 변경, uploaded/pending 외 상태 거부, stale transition 거부를 전용 테스트로 검증
- `npm run test:ontology-action-contract`: 5 passed
- `npm run test:admin-copilot`: 12 passed
- `npm run test:ontology-contract`: 3 passed
- `npm run typecheck`: passed
- `npm run lint`: passed with existing warnings 3건
- `npm run build`: passed with the same existing warnings 3건
- `git diff --check`: passed

## 지금 시작할 곳

Developer QA와 ReviewMaterial Task 1 DB foundation, Task 2 pure action contract helper는 완료되었습니다. 다음 작업은 `docs/ontology-action-implementation-plan.md`의 Task 3에 따라 proposal service를 구현하는 것입니다.

## Blocker / 미검증

- local-first 명령은 `supabase status`에서 연결 정보를 읽고 고정된 로컬 전용 workspace ID와 비밀번호를 사용하므로 별도 QA 환경변수가 필요하지 않습니다. 원격 reset에는 기존 allowlist와 환경변수 안전장치가 유지됩니다.
- post-seed verifier는 DB/Auth/Storage/RLS와 순수 briefing logic을 확인합니다. 실제 페이지 렌더링, evidence link 이동, mutation server action은 이번 로컬 브라우저 smoke에서 별도로 확인했습니다.
- production deployment와 deployed URL runtime은 이 상태 문서 갱신 시점에 확인하지 않았습니다.
- Copilot evidence link는 올바른 관리 화면으로 이동하지만 query로 특정 feedback/material row를 강조하지는 않습니다. 현재 fixture에서는 대상이 명확하며 기능 blocker는 아닙니다.
- 자동 테스트는 순수 규칙 로직과 group-derived projection, 중복 제거, 명시 제외, 삭제 상태, 1,000행 초과 pagination, query 오류 전파를 검증합니다. 실제 Supabase query, 멤버십 권한, home 통합을 포함하는 service/integration test는 아직 없습니다.
- LLM phrasing을 추가하려면 provider, 비용, permission-filtered input contract를 먼저 결정해야 합니다.
- 기존 local Supabase DB에는 현재 branch에 없는 `20260803090000` migration 이력이 남아 있어 해당 DB의 migration history를 수정하거나 reset하지 않았습니다. 대신 격리 DB에 현재 branch migration 전체를 적용하고 RPC/RLS contract를 검증했습니다. 원격 staging/production 적용은 미검증입니다.
- `ReviewMaterial` Task 1 DB foundation과 Task 2 pure helper는 검증됐지만 Proposal service, application-level optimistic stale-state mapping, 승인 UI, signal-resolution integration test는 아직 없습니다.
- Ontology contract와 migration 정적 테스트는 문서·SQL drift를 검증하고, 격리 DB contract는 DB/RPC/RLS 경계를 검증합니다. 역할별 실제 브라우저 승인 흐름은 이후 service/UI 구현 전까지 검증 대상이 아닙니다.

## 기준 문서

- Agent 작업 규칙: `AGENTS.md`
- 용어: `docs/context.md`
- 구조: `docs/architecture.md`
- API와 화면 계약: `docs/api-spec.md`
- Operational ontology: `docs/ontology.md`
- Operational ontology 공통 계약: `docs/ontology-contract.md`
- 공통 계약 구현 계획: `docs/ontology-contract-implementation-plan.md`
- Human-approved action 구현 계약: `docs/ontology-action-implementation-plan.md`
- Developer QA: `docs/developer-qa.md`

## 상태 관리 원칙

- 현재 작업 상태, 검증, blocker, 다음 시작점은 이 파일에서만 관리합니다.
- 실제 코드와 테스트 결과가 이 문서보다 우선합니다.
- 개인 학습 상태는 repository가 아니라 Knowledge Debt Vault의 `DURE/learning.md`에서 관리합니다.
