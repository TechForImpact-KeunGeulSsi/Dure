# Codex repository instruction audit — 2026-09-06

현재 작업 트리의 코드·tests·설정을 기준으로 조사하고 수정했다. 시작 시 AGENTS, CI, package, 여러 개발 문서와 UI 파일에 기존 변경이 있었다. 이 감사는 그 변경을 보존하며 지침·개발 도구·테스트 연결을 수정한다. 제품 권한/출석 계산이나 DB migration은 변경하지 않는다.

## 근거와 저장소 특성

- 단일 npm package, Next.js 15 App Router + React 19 + TypeScript, Tailwind 4, Zod. HTTP 진입점은 `src/app`, 쿠키 갱신은 `src/middleware.ts`, 업무 경계는 `src/services`, DTO/validator/client는 `src/lib`다.
- 외부 런타임 의존성은 Supabase Auth/PostgreSQL/Storage이고 배포 문서는 Vercel을 사용한다. 현재 앱에는 LLM SDK/provider와 cron route가 없다.
- `supabase/migrations`의 ordered SQL이 schema/RLS/RPC/Storage 계약이다. 기존 레거시 SQL은 현재 제품 기능의 증거가 아니다. 원격 적용 상태는 이번 조사 범위 밖이다.
- `package-lock.json`과 `.github/workflows/ci.yml`이 설치/검증 기준이다. CI는 Node 24에서 npm ci → test → typecheck → lint → build를 실행하며 Supabase 값은 placeholder다.
- `.next`, `next-env.d.ts`, `*.tsbuildinfo`는 generated/ignored다. DB 타입 생성 명령은 없다. ESLint flat config가 소스 규칙을 담당한다.
- 루트 외 nested `AGENTS.md`/`AGENTS.override.md`는 없었다. 하위 지침이 필요한 별도 package도 없으므로 새 hierarchy를 만들지 않았다.

## 기존 instruction 분류와 처리

각 행은 기존 루트 지침의 관련 문장/목록을 묶은 것이다. 범용 전역 지침은 repository 파일에 복제하지 않았다.

| 기존 instruction | 분류 | 처리와 근거 |
| --- | --- | --- |
| Next.js 버전과 디렉터리 전수 목록 | 코드에서 추론 가능 | 버전은 package, 상세 tree는 탐색에 맡기고 권한 경계와 핵심 모듈만 유지 |
| 운영 제품 범위와 LLM 부재 | 유지할 repository 사실 | 활성 화면과 보존된 레거시 SQL의 차이를 루트에 유지 |
| source/tests/migrations 우선, 문서 링크 | 유지할 repository 사실 | architecture/API/ontology/UI/STATUS로 탐색 진입점 통합 |
| STATUS 갱신 조건 | 유지할 repository 제약 | scope/blocker/evidence 변경 시 갱신 유지 |
| 개인 Vault에 상태 복제 금지 | 전역/개인 환경 책임 | repository 문장에서 제거; 전역 환경은 수정하지 않음 |
| 서버 서비스 경계, validator/client 사용 | 유지할 architecture 제약 | 실제 서비스·Zod·DTO 위치와 admin 경계 유지 |
| 고정 research → plan → implement → review → verify | Skill 이동/과도한 통제 | 관련 작업에서 필요한 절차만 선택, 별도 산출물 승인 의무 제거 |
| 구현 요청을 계획만 쓰고 중단하지 않기 | 전역 책임 + 조사 Skill | 전역 자율 실행 지침을 중복하지 않고 조사 Skill은 위임 조사/구현 요청의 종료 조건만 구분 |
| 독립 조사/검토 delegation | 전역 책임 | 필요에 따른 위임과 충돌 회피는 전역 working agreement에 맡김; 고정 팀/모델/역할 순서 제거 |
| 모든 완료 전에 verification Skill | 너무 광범위 | 루트는 변경별 기준, Skill은 DB/fixture/release 절차 |
| Node 22+, npm, dev/test 명령 | 유지하되 정확성 수정 | native TS import가 가능한 22.18+와 engines 명시; package scripts로 focused 명령 탐색 |
| reset/seed 명령을 루트에 나열 | Skill/개발 문서 이동 | setup/QA/verification에서 대상과 mutation scope 설명 |
| 모든 .test.ts가 compile-time contract | 오래되어 부정확 | 4개 runtime assert를 .mjs로 실행 연결, removeMember 타입 전용 계약만 유지 |
| 모든 작업의 membership-first 순서 | 너무 광범위 | 기존 workspace 업무에 한정하고 bootstrap 및 권한 확인용 admin lookup 구분 |
| service-role 서버 전용/RLS 보완 | 유지할 invariant | caller ID 신뢰 금지와 함께 유지 |
| 그룹 파생 참여자/명시 제외/dedup | 유지할 domain 제약 | inactive 상태 필터의 실제 차이는 STATUS에 미결정으로 기록 |
| 출석 유효회차/partial/50% | 유지하되 범위 수정 | 누적 출석률과 일별 그래프의 서로 다른 분모 명시 |
| 자료 admin_only/FormData/admin Storage/410/signed URL | 유지할 invariant | admin_only에는 담당 강사도 포함됨을 명시 |
| createInvite 단일 경로 | 유지할 invariant | 그룹 운영자의 범위 제한 초대도 명시 |
| 퇴역 기능 재도입/보존 데이터 삭제 금지 | 유지할 invariant | 앱 퇴역과 DB 기능 폐쇄는 별개라는 검토 지식 보존 |
| 제품 UI에 agent/design 설명 금지 | 유지할 UI 계약 | ui-system 링크와 함께 유지 |
| 한국어 용어, 참여자와 Auth 멤버 구분 | 유지할 domain 제약 | context 링크와 핵심 차이 유지 |
| 변경별 검증, CI와 runtime 증거 구분 | 유지 + 절차 Skill 이동 | 루트에 적용 기준, Skill에 실제 integration/release 방법 |
| 포매팅/스타일 일반 규칙 | linter/type system 책임 | 새 모델 지침으로 추가하지 않음 |
| subdirectory-specific instruction | nested 이동 후보 없음 | 서비스/DB/UI를 가로지르는 제약이므로 루트와 관련 Skill로 유지 |

## Skills 및 local agent 설정

기존 5개 Skill은 SKILL.md만 있었으며 automation script/reference/assets는 없었다. `dure-change-plan`의 cross-layer scoping과 acceptance/rollback 지식을 `dure-repository-research`에 통합했다. 나머지 3개는 Node/DB/Storage/권한/fixture 절차를 중심으로 유지했다.

삭제한 통제: approved plan 없이는 구현 금지, 단독 작업에도 file ownership 요구, 고정 출력 섹션/quality gate, 모든 위험 항목을 매번 none으로 분류, 경계 검토를 무조건 두 번 실행, 모든 지침 수정에 전체 테스트 강제, “npm test contract 없음”, Luna 전용 역할과 Sol 예외 강제.

`.agents/skills`의 현재 DURE Skill 4개는 Git 추적 가능하게 했다. 2026-09-05 감사에서는 `.codex`의 모델/추론 override를 제거했지만, 2026-09-06 사용자 후속 결정으로 local routing을 다시 명시했다. optional agent 역할은 간결한 기획/조사/검토/검증 책임만 가지며, 변경된 설정의 새 세션 runtime 적용은 별도 확인 사항이다.

책임은 root AGENTS(항상 적용되는 사실/제약/검증 기준과 사용자 지정 모델 routing), 선택형 Skills(반복 절차), 현재 user request(목표와 권한)로 분리한다. 이는 instruction 우선순위 표가 아니다. 모델 routing은 Skill에 복제하지 않고 root와 ignored local Codex 설정을 일치시킨다.

## 도구 및 문서 수정

- runtime assertion 4개를 `.test.mjs`로 바꾸고 상대 TS import를 명시해 aggregate에 포함했다. 타입 전용 removeMember 테스트는 유지했다.
- `next lint`를 동일 애플리케이션 소스 범위의 `eslint src`로 교체하고 중복 `.eslintrc.json`을 제거했다.
- package/lock의 engines를 Node 22.18+로 맞췄다. CI의 Node 24 선택과 호환된다.
- 존재하지 않는 `supabase/seed.sql` 자동 seed를 비활성화했다. 데이터 준비는 기존 명시적 fixture script를 사용한다.
- ignored 상태였던 setup 문서를 추적 가능하게 하고, DB 초기 실행과 파괴적 reset을 분리했다. QA 문서에 reset 후 seed → verify 순서를 복구했다.
- architecture의 owner-only 멤버/초대 설명, bootstrap 권한 예외, 출석 분모, inactive 필터, 미사용 JWT/cron 필수 변수 설명을 바로잡았다.

## 검증 범위

실행 결과는 아래 최종 검증 기록을 따른다. pure tests/typecheck/lint/build와 instruction 정적 검토는 DB/Storage/browser/remote 배포 검증을 대신하지 않는다. 코드에서 발견한 inactive 참여자 기준 차이는 제품 선택이 필요하므로 이번 감사에서 수정하지 않았다.

## 참고

공식 [Astra model guidance](https://developers.openai.com/api/docs/guides/latest-model)는 instruction/Skill 충돌 감사와 변경에 맞는 검증 범위 조정을 권장한다. [AGENTS 계층](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Subagents와 custom agent 설정](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Codex config reference](https://learn.chatgpt.com/docs/config-file/config-reference), [Skills](https://learn.chatgpt.com/docs/build-skills)를 참고하되, 실제 변경의 근거는 이 저장소 코드와 실행 결과다.

## 2026-09-05 검증 기록 (이전 작업)

- `npm test`: 26 tests passed, 0 failed (누락되었던 runtime assertion 4개 포함).
- `npm run typecheck`: passed.
- `npm run lint` (`eslint src`): passed, 기존 `month-grid.tsx`의 미사용 `isSameDay` warning 1개.
- `npm run build`: passed.
- `git diff --check`: passed. nested instruction inventory, 명령/링크, TOML 구문, package/lock engines 일치 검사 통과.
- Skill YAML/name/description/scaffold 4개 검사 통과. 공식 `quick_validate.py`는 system/bundled Python의 PyYAML 부재로 실행 불가; 설치된 `js-yaml`로 해당 메타데이터 조건을 별도 확인했다.
- 독립 검토의 문서 충돌 3건(admin 조회 예외, reset 기본 경로, 모델 상속)을 수정한 뒤 해당 구간 재검토에서 추가 지적 없음.
- Supabase 설정은 정적으로 검증했으며 실제 start/migration/seed/reset, DB·Storage·인증 browser, 원격 배포, 새 세션 모델 상속은 실행 검증하지 않았다.

## 2026-09-06 후속 감사와 최종 구조

시작 시 이미 수정되어 있던 4개 Skill과 미커밋 파일을 이번 감사의 기준선으로 삼았다. 위 5→4 Skill 통합 기록은 어제 작업이며 오늘 추가 삭제한 Skill은 없다. 자동화 script/reference를 삭제하지 않았다.

- 루트의 Task Workflows를 제거하고 선택형 Skill 링크를 Architecture로 옮겼다. routine 판단·질문·위임은 전역 working agreement와 현재 사용자 요청에 맡긴다. 후속 사용자 결정에 따라 모델 선택만 별도 routing으로 명시했다.
- TDD Skill의 일반적인 승인/파일 소유권 설명, boundary Skill의 반복 리뷰 횟수·고정 출력 설명을 제거했다. research Skill은 조사 전용 위임과 구현 요청의 종료 조건을 이미 명확히 구분하므로 유지했다.
- verification Skill은 seed 자체 검증과 별도 verify의 용도를 구분했다. QA 문서의 참여자 권한 검증 주장은 실제 `verifyRoleScopes`가 멤버십·수업 RLS·그룹 RPC만 검사한다는 설명으로 바로잡았다.
- architecture는 material enum 값과 row CHECK를 구분하고, 출석 배정일 fallback을 기록했다. 원 업로더의 자료 권한은 담당 강사 계약과 다른 현재 동작 후보로 STATUS에 기록했으며 invariant로 승인하지 않았다.
- README/setup의 설치 예제를 lockfile 기반 `npm ci`로 통일했다. 기존 package/CI/test runner 변경은 그대로 보존했다.

추가 분류: 기존 `CourseCard.viewType` 호출 세부 사항은 컴포넌트/API 타입과 호출부에 맡긴다. 임시 파일·도구 상태 목록은 `.gitignore`, 일반 서버/클라이언트 역할 설명은 architecture, 과거 문서 전면 열람 금지는 현재/역사 문서 구분으로 대체한다. fixed Tier·handoff·모델 예외 횟수는 Skill로 복제하지 않는다.

```text
AGENTS.md                         # Overview / Architecture / Commands / Constraints / Domain / Verification
.agents/skills/
  dure-repository-research/        # 조사와 cross-layer 범위 설정
  dure-tdd-vertical-slice/          # 행동 변경과 테스트 선택
  dure-boundary-review/            # 권한·파일·민감 데이터 경계 검토
  dure-verification/               # fixture·DB·브라우저·release 증거
.codex/config.toml, agents/*.toml  # 개인 ignored helper와 모델/추론 routing
docs/{architecture,api-spec,ontology-contract,ui-system,context}.md
                                  # 현재 제품 계약
docs/{setup,developer-qa}.md       # 실행 절차
docs/STATUS.md                    # 현재 blocker와 날짜별 검증 증거
```

nested AGENTS/override는 없으며 새로 만들지 않았다. 전역 설정은 수정하지 않고 ignored `.codex`에 project/main·기본 subagent를 Luna xhigh로 설정했다. `dure_planner`는 Sol high, `dure_large_planner`는 큰 범위 구현 기획 전용 Astra medium이며 구현은 Luna로 돌려보낸다. boundary/code-review/verifier도 Luna xhigh다. 기본 routing은 Astra high 이상을 선택하지 않지만, 명시적 runtime override 자체를 차단하는 관리형 정책은 추가하지 않았다. 현재 부모 세션은 시작 후 설정을 바꿨으므로 실효 적용은 새 task/restart에서 확인해야 한다.

### 이번 실행 검증

- Node `v22.23.1`, npm `10.9.8`에서 `npm test`: 26 passed; `npm run typecheck`: passed; `npm run lint`: errors 0, 기존 `month-grid.tsx` 미사용 `isSameDay` warning 1개.
- `npm run build`: passed. 환경/자격증명 파일 없이 현재 앱 소스·설정·기존 dependencies를 사용하는 `/private/tmp/dure-instruction-build-996prwt9`에서 CI placeholder로 실행했다. 원본 개발 서버의 `.next`는 덮어쓰지 않았다.
- package/lock dependencies·devDependencies·engines 일치, CI YAML, 문서의 npm script 존재 여부, 상대 링크, Skill 4개 YAML/name/description/scaffold, Supabase 및 local agent TOML 검사 passed.
- 공식 Skill validator는 현재 Python의 PyYAML 부재로 실행 불가. 설치된 `js-yaml`로 메타데이터와 scaffold 조건을 검사했다.
- Supabase CLI `--version`/`migration up --help`는 sandbox 밖 `~/.supabase/telemetry.json` 쓰기 오류로 확인하지 못했다. start/migration/seed/reset은 실행하지 않았다. 이 호스트의 CLI 호환성과 DB·Storage·인증 브라우저·배포는 미검증이다.
- `npm ci` 신규 설치는 실행하지 않았으며 기존 설치로 검사했다. 실제 CI/원격 migration 통과를 주장하지 않는다.
- Astra medium 독립 최종 검토에서 발견한 QA verifier 설명의 과장(회차별 상태 검증, 모든 검증의 역할별 실행)을 수정했다. 실제 구현은 역할별 멤버십·수업·그룹 RPC 확인과 admin count/Storage 검사를 구분한다. 나머지 검토 범위에서 추가 지적 없음.
- 최종 `git diff --check`와 untracked Skill을 포함한 문서 링크·공백 검사 passed. 후속 routing 변경은 local agent TOML parse와 정확한 모델 matrix를 별도로 검사했다. Luna xhigh 독립 검토에서 지적한 기본값과 hard enforcement의 표현 차이를 위와 같이 교정했다.
