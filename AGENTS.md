# DURE Agent Instructions

이 문서는 DURE 레포에서 작업하는 에이전트의 기준 지침입니다. 오래된 단계별 인수인계보다 현재 기준 문서를 우선합니다.

## 우선순위 문서

1. `AGENTS.md`
2. `docs/STATUS.md`
3. `docs/context.md`
4. `docs/architecture.md`
5. `docs/api-spec.md`
6. `README.md`
7. `supabase/README.md`

작업을 시작할 때는 `docs/STATUS.md`의 현재 상태, blocker, 다음 작업을 먼저 확인합니다. 상태가 바뀌면 같은 파일을 갱신하고, 개인 Vault에는 작업 상태를 복제하지 않습니다.

이 브랜치에서는 과거 PRD, 발표 자료, brainstorm/spec 산출물을 작업 컨텍스트에 포함하지 않습니다. 필요한 과거 자료는 `main` 브랜치 또는 Git 이력에서 확인하고, 현재 구현 판단에는 최신 문서와 코드를 사용합니다.

## AI 엔지니어링 오케스트레이션

비사소한 작업은 `조사 -> 계획 -> 구현 -> 독립 리뷰 -> 검증 -> 학습`으로 분리합니다. 구현 컨텍스트 자체를 정확성의 증거로 보지 않습니다. 항상 켜지는 정책은 이 `AGENTS.md` 하나이며, Codex 전용 역할은 `.codex/agents/`, 재사용 절차는 `.agents/skills/`에 둡니다. `.claude/`, 별도 명령 트리, 중복 오케스트레이터 문서는 만들지 않습니다.

### 최소 팀

| 역할 | 구현 | 기본 책임 |
| --- | --- | --- |
| Chief Orchestrator | 현재 주 에이전트 | 위험 분류, 단계 gate, 컨텍스트와 승인 경계, 최종 판정 |
| Repository Researcher | 내장 `explorer` | 현재 동작, symbol/usage, 유사 패턴, migration/test 근거 조사 |
| Product Planner | `dure_planner` (`Sol high`) | 실제 제품 기획, 큰 범위 합성, cross-cutting 구조 정리 |
| Boundary Reviewer | `dure_boundary_reviewer` | schema/auth/tenant/admin-client/privacy 변경의 사전·사후 독립 검토 |
| TDD Implementer | 내장 `worker` | 승인된 범위의 최소 vertical slice 구현과 RED/GREEN 증거 |
| Independent Reviewer | `dure_code_reviewer` | 계획·diff·주변 코드만으로 correctness/regression 검토 |
| Verifier | `dure_verifier` | 코드, DB, 브라우저, 배포 증거를 구분해 PASS/FAIL 판정 |

호스트가 delegation을 지원하고 허용할 때 위 역할을 깨끗한 별도 컨텍스트로 실행합니다. 새 `.codex/agents` 정의가 현재 실행 중인 세션에 아직 노출되지 않으면 새 Codex task/restart에서 다시 확인합니다. 그 전에는 boundary/code reviewer를 Luna xhigh `explorer`에 해당 역할 지침과 함께 위임하고, verifier는 Luna xhigh `worker`에 코드 수정 금지 조건으로 위임합니다. Sol 조건에 해당하는 실제 제품 기획만 `gpt-5.6-sol` + `high`를 명시해 별도 planning agent를 호출합니다. 호스트 정책이 delegation을 금지하면 같은 단계와 산출물 경계를 명시적으로 유지합니다. Orchestrator는 큰 구현을 독점하지 않습니다.

### 모델 라우팅

- 프로젝트 기본과 기본 subagent는 `.codex/config.toml`의 `gpt-5.6-luna` + `xhigh`입니다.
- 조사, scoped implementation plan, 구현, 테스트, boundary review, code review, 검증, 작은 문서 정리는 Luna xhigh를 사용합니다.
- `dure_planner`의 Sol high는 제품 목표·범위·roadmap·수락 기준이 모호한 실제 기획, 여러 도메인을 가로지르는 architecture 방향, 큰 repository/운영 구조 정리에만 사용합니다.
- 단순 버그 계획, 명확한 기능 구현 계획, 코드 작성, 반복 검증에는 Sol을 호출하지 않습니다. 한 작업에서 Sol planner는 기본적으로 한 번만 호출하며, handoff에 Sol이 필요한 이유를 한 문장으로 적습니다.
- 사용자가 특정 모델을 명시하면 그 요청을 우선합니다. 현재 실행 중인 session override는 project config보다 우선할 수 있으므로 새 task에서 적용 상태를 확인합니다.

### 작업 라우팅

- Tier 0, 명백한 문구·작은 문서 수정: `Implement -> Verify`
- Tier 1, 일반 버그·작은 기능: `Research(Luna) -> Scoped Plan(Luna) -> TDD Implement(Luna) -> Independent Review(Luna) -> Verify(Luna)`
- Tier 2, DB/Auth/RLS/RPC/파일/민감정보/admin client/공개 데이터/기존 외부 연동: `Research(Luna) -> Scoped Plan(Luna) -> Boundary Review(Luna) -> Implement(Luna) -> Code Review(Luna) -> Boundary Review(Luna) -> Verify(Luna)`
- Tier 3, 큰 모호성·실제 제품 기획·새 외부 연동·운영 구조 변경: `Research(Luna) -> Product Plan(Sol high, 1회) -> explicit checkpoint -> Tier 2 실행(Luna)`. 제품 결정을 저장소 근거만으로 확정할 수 없을 때 사용자 승인을 받습니다.
- 조사·설명만 요청된 경우 구현 단계로 확장하지 않습니다.

필요한 절차만 적용합니다: `dure-repository-research`, `dure-change-plan`, `dure-tdd-vertical-slice`, `dure-boundary-review`, `dure-verification`. 모든 역할을 모든 작업에 호출하지 않습니다.

### Artifact handoff

전체 대화 대신 다음 최소 산출물을 다음 역할에 전달합니다.

- `research-summary`: 관련 파일, 현재 동작/흐름, 기존 패턴, 제약, unknown, risk
- `implementation-plan`: 문제, 현재/목표 동작, scope/non-goal, 영향, 수락 기준, test/rollback
- `boundary-review`: `APPROVE | CHANGES_REQUIRED`, 역할·테넌트별 허용/거부, 위협과 필수 테스트
- 구현 결과: diff, RED/GREEN 증거, 계획 편차, 남은 위험
- `review-findings`: `CRITICAL | HIGH | MEDIUM | LOW`, `path:line`, 영향, 재현 또는 수정 방향
- `verification-report`: 실행 명령, 계층별 `PASS | FAIL | UNVERIFIED`, 미검증과 release evidence

긴 작업에서 파일 handoff가 필요할 때만 ignored local `agent-workbench/` 아래 task-scoped 폴더를 사용합니다. 제품 상태와 검증 결과는 계속 `docs/STATUS.md`를 단일 기준으로 유지합니다.

### 완료와 학습 gate

- 수락 기준, 관련 테스트, 필요한 typecheck/lint/build, 독립 리뷰가 끝나기 전 완료라고 하지 않습니다.
- 권한·테넌트·개인정보 영향이 있으면 UI 미노출이 아니라 service/RLS/RPC/admin-client 실제 경계를 검증합니다.
- 코드·DB·브라우저·배포·migration·persistence 증거를 서로 대체하지 않습니다.
- reviewer finding은 수정되거나 사용자가 명시적으로 수용해야 합니다.
- 재사용 가능한 사실을 배웠을 때만 가장 작은 기준 문서나 skill을 갱신하고, 중복·오래된 지침은 늘리지 않습니다.

## 작업 원칙

- 앱 코드는 `src/`, DB 기준은 `supabase/migrations/`, 현재 문서는 `docs/`에 둡니다.
- 발표 자료, 임시 이미지, 로컬 도구 상태, 과거 시행착오 문서는 루트에 두지 않습니다.
- 페이지는 업무 테이블을 직접 흩어 조회하지 않고 `src/services/`의 query/action을 사용합니다.
- 서버 컴포넌트는 데이터 로딩, 클라이언트 컴포넌트는 폼/모달/인터랙션 상태에 집중합니다.
- 새 입력/수정 흐름은 `src/lib/validators/`의 Zod schema를 통해 검증합니다.
- 권한 버튼 숨김은 UX 보조일 뿐이며, 실제 권한은 service 계층과 Supabase RLS/admin client 사용 지점에서 다시 검증합니다.

## Supabase/Admin Client 주의

`SUPABASE_SERVICE_ROLE_KEY`는 service_role JWT여야 합니다. anon key를 넣으면 자료 업로드, 멤버 초대, signed URL 발급, Auth admin 호출이 `"No suitable key or wrong key type"` 오류로 실패합니다.

admin client 우회는 RLS의 `current_member_id(workspace_id)` 비교가 SSR 환경에서 안정적으로 통과하지 않는 테이블에 한해 사용합니다. 이 경우 반드시 service 계층에서 권한을 먼저 검증하고, 새 우회가 생기면 README 또는 관련 문서에 이유를 남깁니다.

현재 admin client 우회가 사용되는 대표 작업:

- `materials`와 `course-materials` storage
- `attendance_records`
- `class_memos`
- `workspace_members`
- `invites`, `invite_courses`, `workspace_member_groups`

## 현재 유지해야 할 구현 패턴

- `loadCurrentMembership`류 조회는 현재 사용자의 `user_id = auth.uid()` 필터를 포함해야 합니다.
- `CourseCard.viewType`은 `manager | instructor`를 명시적으로 전달합니다.
- 자료 업로드는 signed upload URL 3단계가 아니라 server action의 `FormData`와 admin `storage.upload()` 흐름을 사용합니다.
- `/api/materials/upload-url`은 사용 중단된 410 route입니다. 되살리지 않습니다.
- 초대 생성은 `src/services/invites.ts`의 `createInvite`를 단일 진입점으로 사용합니다.

## 레포 정리 기준

마스터 레포에는 다음만 남깁니다.

- 실행 가능한 제품 코드
- DB migration/config
- 현재 개발과 운영에 필요한 문서
- 실제 앱에서 참조하는 정적 자산

다음은 현재 브랜치에 두지 않습니다. 필요한 경우 `main` 브랜치 또는 Git 이력에서 확인합니다.

- `.DS_Store`, `.tmp-*`, 로컬 screenshot
- `.claude/`, `.codex/`, `.playwright-mcp/`, `.superpowers/`, `.vercel/`
- 발표 자료와 시연 GIF
- 과거 단계별 PRD/spec/mockup
- 일회성 데이터 추출 자료
