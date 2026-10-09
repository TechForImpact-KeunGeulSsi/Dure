# Project Status

최종 갱신: 2026-09-06

## 현재 상태

현재 checkout에는 운영 범위 정리와 출석 대시보드 변경이 있다. workspace home은 운영 중 수업을 가로 복수 필터로 선택하고, 선택 날짜의 회차별 출석 그래프와 참여자 누적 출석률을 제공한다. 코파일럿 홈 UI·서비스·action은 제거했으며, 과거 migration과 자료·운영 데이터는 보존한다.

2026-09-04 첫 현장 배포 discovery 준비: 로컬 전용 `docs/pm/user-research/mapo-center/field-mission-2026-09-07/` Field Kit(01~08, post-visit synthesis)를 생성했다. 이번 단계에서는 제품 코드·DB·RLS·Storage·배포를 변경하지 않았고, 실제 센터 workflow·권한·효과는 현장 미검증으로 유지한다.

기존 Darori 사용자 테스트 seed와 분리된 local-first developer QA smoke fixture는 계속 유지한다. 레거시 피드백·정산 행과 영수증 객체는 보존하되 활성 화면에서 사용하지 않는다. 원격 staging과 인증된 브라우저 역할 검증은 별도 release 단계다.

마포 장애인 가족 지원 센터 대시보드 설명을 위한 별도 local-only 데모 fixture도 유지한다. 데모는 고정된 별도 workspace에 가상 수업·참여자·출석 데이터를 넣으며 기존 `DURE Developer QA` workspace를 변경하지 않는다.

현재 DURE는 Supabase를 source of truth로 유지한다. 대시보드 계산은 서버의 permission-scoped query와 `attendance-dashboard-logic.ts` 순수 함수로 분리했다. 누적 출석률은 참여자 배정일 이후 종료된 유효 회차 중 기록이 있는 회차를 분모로 하며, `present`와 `partial`은 출석 1회로 세고 `absent`는 유효회차에 포함한다. 미입력은 분모에서 제외하고 정확히 50%는 저출석이 아니다.

2026-09-05 repository instruction audit:

- `AGENTS.md`를 repository invariant, 실제 명령, non-obvious domain constraint와 verification 기준 중심으로 축소하고, 고정된 역할표·Tier·artifact handoff 같은 반복 workflow는 local Skills와 agent 정의의 책임으로 정리했다.
- 모델/추론 강도는 전역 Codex 설정을 상속하도록 local override를 정리했다. `.codex/`는 개인 설정으로 ignored 상태를 유지하며 재사용 가능한 `.agents/skills/dure-*`는 추적 가능하게 했다.
- 누락된 runtime assertion 4개를 `.test.mjs`로 전환해 `npm test`에 포함했다. `workspace-members.remove-member.test.ts`만 타입 전용 계약으로 남긴다. native TypeScript import 때문에 Node 최소 버전은 22.18이며 CI는 Node 24를 사용한다.
- `next lint`를 동일 소스 범위의 `eslint src`로 교체하고 중복 legacy ESLint 설정을 제거했다. 존재하지 않는 `seed.sql` 자동 실행은 끄고 명시적 QA seed 절차를 유지한다.
- 제거된 Copilot task/evidence 절차와 과거 ontology 구현의 현재 runtime 서술을 문서에서 교정했으며, legacy migration·행·Storage 보존 지식은 삭제하지 않았다.

이번 instruction/tooling 수정 검증: `npm test` 26 passed, typecheck/build passed, `eslint src` passed(기존 isSameDay warning 1개), diff 및 instruction 정적 검사 passed. 독립 검토 지적 수정 후 재검토 완료. DB/Storage/browser/배포와 새 세션 모델 상속은 미검증이다. 상세 분류는 [instruction audit](codex-instruction-audit.md)에 있다.

2026-09-06 instruction audit 후속 완료:

- 어제 미커밋 변경을 보존하고 루트 지침의 전역 자율성·모델·팀 운영 문구 중복을 제거했다. 작업별 Skill 링크는 Architecture에 모았다.
- Skills 4개는 역할을 유지하고 중복 승인/출력 지시를 정리했다. seed가 자체 검증한다는 점과 fixture verifier가 Next.js 서비스·참여자 역할별 거부·교차 workspace를 검증하지 않는다는 범위를 명확히 했다.
- 자료 enum/CHECK, 배정일 fallback, 원 업로더의 권한 예외를 코드와 대조해 문서에 반영했다. 제품 코드나 DB 권한은 이번 후속 작업에서 변경하지 않았다.
- 현재 재검증: 테스트 26 passed, typecheck/lint/build passed(기존 lint warning 1개). build는 환경 파일 없는 임시 소스 복사본과 CI placeholder를 사용했다. Supabase CLI help/version은 telemetry 파일 쓰기 sandbox 오류로 미확인이다. DB/Storage/browser/배포는 미검증이다.
- 사용자 지정 model routing을 적용했다. 큰 범위 구현 기획은 `dure_large_planner`의 Astra medium, 그보다 작은 별도 기획은 `dure_planner`의 Sol high, 구현·일상 조사·검토·검증 기본값은 Luna xhigh다. 이 기본 routing에서는 Astra high 이상을 선택하지 않는다. 전역 설정이나 명시적 runtime override를 차단하는 관리형 정책은 수정하지 않았고, 현재 세션의 실효 적용은 증명하지 않았으므로 새 task/restart 확인이 남아 있다.

자료 권한 미준수 후보: 활성 원 업로더는 담당 수업 해제 후에도 `src/services/materials.ts:canEditMaterial`과 `can_access_material` RLS의 uploader 분기로 기존 자료 조회·다운로드·수정/교체가 허용될 수 있다. 담당 수업만 접근한다는 `docs/api-spec.md` §14 계약과 다르다. 이번 감사에서는 동작을 변경하지 않았으며, 담당 해제 후 service/RLS 허용·거부 실행 검증과 정책 결정이 남아 있다.

미결정 상태 필터: 대시보드는 활성 참여자만 포함하지만 `attendance.ts`와 `course-participants.ts`는 삭제되지 않은 inactive 참여자도 포함한다. 이번 지침 audit은 이 제품 동작을 변경하지 않는다.

운영 데이터 계약은 `docs/api-spec.md`와 `docs/ontology-contract.md`에 반영했다. 현재 활성 홈 계약은 `getAttendanceDashboard`이며, `수업·참여자`와 `운영자·강사` 관리 화면 및 기존 자료 관리는 유지한다. 종료된 피드백·정산 객체와 코파일럿 관련 migration·행은 보존 데이터로만 취급한다.

현재 상태 아래의 날짜가 붙은 항목은 변경 이력이다. 현재 동작은 위 요약과 source/tests/migrations 및 현재 기준 문서로 다시 확인한다.

2026-09-03 UI alignment 기준 정리:

- `docs/ui-system.md`를 추가해 현재 운영 화면의 시각 토큰, 공통 컴포넌트, 페이지 패턴, 역할·용어, 적용 순서와 완료 기준을 고정했다.
- `docs/ui-audit-matrix.md`를 추가해 활성 화면별 역할, 업무, 기준 컴포넌트, alignment 확인 항목을 고정했다.
- `Card`, `Table`, 운영자·강사 수업 탭의 직접 색상값을 기존 UI 토큰으로 연결했다. 시각적 기준만 정렬했으며 동작은 변경하지 않았다.
- `AGENTS.md`에 제품 계약에 없는 설명문·주석형 UI 카피·AI 작업 해설·설계 의도 문구를 추가하지 않는 제한을 명시했다.
- 이번 단계에서는 UI 컴포넌트와 문서·작업 지침만 변경했으며 API, DB, RLS, Storage는 변경하지 않았다.

2026-09-02 운영 범위 정리:

- 마을별 둘러보기 공개 카탈로그와 공개 수업 상세/피드백 입력 route·component·service를 제거
- owner/instructor 정산 요청 route·component·service와 관련 navigation/tab을 제거
- Admin Copilot의 신규 피드백 signal, briefing metric, evidence link를 제거하고 활성 task를 3개로 정리
- activity query에서 활성 target type만 먼저 조회하고 레거시 피드백·정산 event를 projection에서도 제외해 dead link와 민감한 정산 금액 노출을 차단
- 기존 피드백·정산 DB 행과 영수증 Storage 객체는 유지하고, 정산 RLS/Storage policy와 공개 자료 anonymous-read policy는 forward migration에서 종료
- 기존 공개 자료는 `admin_only`로 정리하고 DB check constraint·신규 업로드를 통해 워크스페이스 내부 전용으로 고정
- 자료 업로드는 역할뿐 아니라 대상 수업의 workspace/course scope를 service layer에서 재검증하고, activity actor·course target도 workspace와 역할 범위로 제한

## 최근 검증

> 아래 날짜별 항목은 당시 checkout에서 실행한 historical evidence입니다. 명령·화면·기능이 현재 제거되었을 수 있으므로, 실행 가능한 현재 명령은 `package.json`, `README.md`, `AGENTS.md`를 기준으로 확인합니다. Copilot/ReviewMaterial 관련 항목은 현재 release 기준이 아닙니다.

2026-10-09 B 출력 화면 목업 (`feat/b2-report-logic`, `feat/mockup-fake-data` 위):

- B2 `/reports`: 월·분기·연도 실인원·연인원, 수업·성별·연령대·장애 유무별 표와 거르기, 숫자 근거 기록, 기간 내 출석 미입력 경고. 계산 기준은 PR 통합 문서 7.1 초안(출석·부분 출석을 참여로, 휴강·미입력 제외, 연령대 = 기준연도 - 출생연도)이며 센터 확인 전이다.
- B3 제출 파일: 이름 가운데 가림, 연락처·주소·메모·내부 번호·장애 유형 제외, 의존성 없는 xlsx(요약·참여자 명단·계산 기준, 숫자 값만), 미입력이 있으면 확인 후 내보내기, 인쇄·PDF는 엑셀과 같은 내용을 인쇄. 제출 파일 생성 이력은 아직 저장하지 않는다.
- B4 `/reports/low-attendance`: 월 기록 2회 이상·50% 미만 저출석자, 연락 결과·메모를 `attendance_contact_notes`(새 migration, RLS 포함)에 저장. 진행 중 수업만 대상이다.
- B1 홈 상단: 이번 달·분기·올해 실인원·연인원, 수업별 연인원, 지난달 저출석자 수, 기간 미입력, 보고서 링크. 파일 가져오기 미확정 표시는 A 파트(가져오기) 완성 후 붙인다.
- 보고서·저출석자·내보내기는 `owner_admin`·`group_admin`만 허용(결정 1의 운영자), 강사는 `ROLE_FORBIDDEN`.
- `npm test`: 35 passed, 1 failed (기존 `operational-scope.test.mjs` Windows CRLF 실패)
- `npm run typecheck`, `npm run build`: passed / `npm run lint`: 기존 `month-grid.tsx:8` warning만
- `npx supabase migration up --local`: `attendance_contact_notes` 적용
- local owner browser: 3분기 실인원 30·연인원 272, 여성·장애인 거르기 7명, 근거 기록, 제출 파일 창·xlsx 응답(200, 가린 이름만 포함, 수식 없음), 8월 저출석 7명과 연락 메모 저장·새로고침 유지, 홈 요약 확인
- local instructor browser: `/reports`, `/reports/low-attendance`, export API 모두 거부(403), 사이드바에 보고서 없음. 다른 workspace export는 `WORKSPACE_ACCESS_DENIED`(403)
- local group_admin(`mapo.demo.operator`, 센터 그룹) browser: 보고서 실인원 30, export 200, 저출석자 조회 허용
- 홈 상단 요약은 이번 달·분기·올해 전환과 수업별 연인원 막대를 포함한다. 인쇄·PDF는 엑셀과 같은 요약·참여자 명단·계산 기준을 인쇄한다(가린 이름만 포함 확인).
- 인쇄·PDF 첫 쪽에 제출용 그래프 3종(월별 연인원 추이, 수업별 참여, 성별·장애 유무·연령대 구성)을 넣었다. 색은 dataviz validator를 통과한 파랑·주황 2색이다. 엑셀 내 그래프는 다음 미팅 이후로 미뤘다.
- 인쇄 시 대시보드 레이아웃의 스크롤 영역(`main overflow-y-auto`) 때문에 PDF 아래가 잘리던 문제를 print 스타일로 고쳤다. headless Edge `printToPDF`로 3분기·연간 PDF가 4쪽 전체(명단 30명·계산 기준) 출력되는 것을 확인했다.
- 원격 DB 적용은 하지 않았다.

2026-10-07 목업용 마포 데모 데이터 확장 (`feat/mockup-fake-data`):

- `participants`에 보고용 nullable 열 `internal_no`, `gender`, `birth_year`, `has_disability`를 추가하는 migration을 작성했다. 연령대는 출생연도에서 계산하고, 장애 유형·진단명은 저장하지 않는다.
- 마포 데모 fixture를 가상 참여자 30명(1인 1수업, 수업당 5명), 6개 수업 × 주 1회 13회차(78회차, 휴강 1회), 출석 기록 380건으로 확장했다. 저출석 4명, 정확히 `6/12 (50%)` 정상 4명, 기준일 미입력 2건, 동명이인, 중단 후 복귀 사례를 포함한다.
- seed의 Windows `supabase` 조회를 `dev-local.mjs`와 같은 방식으로 고쳤다.
- `npm run test:mapo-dashboard`: 4 passed
- `npx supabase migration up --local`: 새 migration 적용
- `npm run seed:mapo-dashboard:local -- --reset`, `npm run verify:mapo-dashboard:local`: passed (DB 참여자 30명, 보고용 열 채움, 출석 380건)
- `npm test`: 27 passed, 1 failed (`scripts/operational-scope.test.mjs`의 기존 실패. Windows CRLF checkout에서 `\n` 정규식이 맞지 않음, 이번 변경과 무관)
- `npm run typecheck`: passed / `npm run lint`: 기존 `month-grid.tsx:8` warning만
- 앱 화면은 참여자 열을 아직 표시하지 않으며, 브라우저 확인은 하지 않았다. 원격 DB에는 적용하지 않았다.

2026-09-03 출석 대시보드 개편:

- workspace home을 `getAttendanceDashboard` 기반의 실제 DURE 대시보드 UI로 교체했다.
- 수업 필터를 가로 다중 선택으로 배치하고, 선택 날짜의 회차 그래프·상태 범례·주의 수업·참여자 출석률 상세를 연결했다.
- 누적 판정은 참여자 배정일 이후 종료된 유효 회차 기준이며 `present/partial`은 출석 1회, 미입력은 분모 제외, 정확히 50%는 정상이다.
- 코파일럿 UI·서비스·action·관련 순수 테스트를 제거하고 자료 원본·레거시 migration·보존 데이터는 유지했다.
- `npm run test:attendance-dashboard`: 4 passed
- `npm run test:developer-qa`: 2 passed
- `npm run test:operational-scope`: 3 passed
- `npm run test:ontology-contract`: 2 passed
- `npm run typecheck`: passed
- `npm run lint`: passed with the existing `src/components/calendar/month-grid.tsx:8` unused `isSameDay` warning and `next lint` deprecation warning
- `npm run build`: passed with the same existing lint warning
- `git diff --check`: passed

2026-09-03 마포 센터 대시보드 데모 데이터셋:

- 별도 local-only workspace `마포 장애인 가족 지원 센터 데모` seed와 verifier를 추가했다.
- `생활체육교실`, `미술활동`, `음악교실`, `요리활동`, `디지털활동`, `일상생활훈련` 6개 수업, 36회차, 가상 참여자 18명, 출석 기록 205건을 구성했다.
- 여러 `2/6` 저출석, 정확히 `3/6 (50%)` 정상, 부분 출석, 미입력 사례를 수업별로 분산했다.
- `npm run test:mapo-dashboard`: 2 passed
- `npm run seed:mapo-dashboard:local -- --reset`: passed
- `npm run verify:mapo-dashboard:local`: passed
- local owner browser에서 수업 3개 가로 필터, 일별 그래프, 저출석 2명, `김하늘 2/6`, `박지후 3/6 정상`을 확인했다.
- `npm run typecheck`: passed
- `npm run lint`: passed with the existing `src/components/calendar/month-grid.tsx:8` unused `isSameDay` warning and `next lint` deprecation warning
- `npm run build`: passed
- `git diff --check`: passed

2026-09-02 DURE AI engineering orchestration bootstrap:

- 제품 코드는 변경하지 않고 root `AGENTS.md`에 risk tier, artifact handoff, independent review, evidence-based completion 정책을 추가
- Codex native local 경로에 custom agent 4개(`.codex/agents`)와 DURE skill 5개(`.agents/skills`)를 추가하고 공개 branch에는 포함되지 않도록 ignore 경계를 유지
- agent TOML 4개 `tomllib` parsing/required field/name/sandbox 검증: passed
- skill 5개를 공식 skill-creator `quick_validate.py`로 검증: 모두 `Skill is valid!`
- role/skill/document 참조 해석, ignore 계약, no-product-code diff, `git diff --check`: passed
- 현재 실행 중인 세션의 custom agent runtime discovery는 관찰하지 못했으며, 새 Codex task/restart에서 확인 필요. 그 전에는 내장 `explorer`/`worker` fallback을 사용
- 감사에서 CI가 일부 기존 ontology-action test와 local Supabase/browser 검증을 포함하지 않는 점을 기존 verification gap으로 확인. 이번 bootstrap에서는 CI/product 설정을 변경하지 않음
- 당시 model routing은 project/main agent와 기본 subagent 및 custom boundary/code-review/verifier를 `gpt-5.6-luna` + `xhigh`로 고정했고, `dure_planner`만 실제 제품 기획·큰 범위 합성에 한해 `gpt-5.6-sol` + `high`를 사용했다. 2026-09-05 audit에서 이 local override를 제거했으나 2026-09-06 사용자 후속 결정으로 현재 routing을 새 기준으로 다시 설정했다.

2026-09-02 운영 범위 정리 검증:

- `npm run test:operational-scope`: 3 passed
- `npm run test:admin-copilot`, `npm run test:developer-qa`, `npm run test:ontology-contract`, `npm run test:ontology-action-migration`, `npm run test:ontology-action-contract`, `npm run test:ontology-action-validator`, `npm run test:darori-seed`: 모두 passed
- `npm run typecheck`: passed; `git diff --check`: passed
- `npm run lint`: passed; 기존 `src/components/calendar/month-grid.tsx:8`의 미사용 `isSameDay` warning과 `next lint` deprecation warning이 남음
- `npm run build`: passed; 생성 route에 retired public catalog·feedback·settlement route가 없음을 확인

2026-08-31 Vercel Production 배포:

- 기존 `dure` Production은 `4855b56`으로 배포되어 있었고, 현재 에이전트 구현이 포함된 `4d129ca`와 달라 clean snapshot 배포를 진행함
- `4d129ca` clean snapshot을 Vercel `dure` 프로젝트에 배포: `dpl_7DqRKpT6GmQzMvCN7HfptDTduXxh`, `READY`, alias `https://dure-phi.vercel.app`
- Production `/`와 `/login` 응답은 각각 HTTP 200
- Vercel 배포는 Supabase migration을 실행하지 않으므로 원격 `20260805090000_ontology_action_review_material.sql` 적용 여부와 인증된 Admin Copilot/ReviewMaterial runtime은 별도 미검증

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

2026-08-12 UI 조정:

- 참여자·수업 관리의 그룹·참여자·수업 목록을 다른 운영 화면과 같은 흰색 표면으로 정리하고, 로컬 대표 운영자 브라우저에서 세 탭의 목록 렌더링과 콘솔 오류 없음을 확인
- 강사·운영자 관리 화면에 대표 운영자·그룹 운영자용 멤버 초대 버튼을 연결하고, 그룹 운영자는 자기 접근 범위에서만 그룹 운영자·강사를 초대하도록 권한 계약과 화면을 정리
- 공개 랜딩의 실사 교육 운영 이미지를 제거하고, 기존 지구본과 어울리는 네이비·블루·라임 계열의 3D 학습 허브 오브젝트로 교체

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

2026-08-05 ReviewMaterial Task 3 구현·focused 검증:

- `src/services/ontology-actions.ts`에 active `owner_admin` 재검증, workspace-scoped material/course reload, 서버 측 Admin Copilot task/evidence 재생성, fingerprint 중복 조회·insert race 처리를 구현
- `src/lib/validators/ontology-action.ts`에 proposal/decision 입력 schema를 추가하고, 잘못된 UUID·target version 및 빈 decision note 정규화를 검증
- `npm run test:ontology-action-validator`: 2 passed
- `npm run test:ontology-action-contract`: 5 passed
- `npm run test:ontology-action-migration`: 3 passed
- `npm run test:admin-copilot`: 12 passed
- `npm run test:developer-qa`: 3 passed
- `npm run test:ontology-contract`: 3 passed
- `npm run typecheck`: passed
- `npm run lint`: passed with existing warnings 3건
- `npm run build`: passed with the same existing warnings 3건
- `git diff --check`: passed

2026-08-05 ReviewMaterial Task 4 구현·focused 검증:

- `src/services/ontology-actions.ts`에 owner membership 재검증, 승인·거절 RPC 호출, proposal/action/version 경계 확인, proposal별 고정 idempotency key, stale/replay/비대기 proposal 결과 매핑, 승인 후 proposal·execution·material 재조회와 `home`/materials 경로 재검증을 구현
- 승인 결과는 `succeeded | replayed`, 거절 결과는 `rejected`로 반환하고, stale은 `CONFLICT`와 `STALE_PROPOSAL` metadata로 반환; 승인 audit의 proposal·actor·idempotency key 일치도 확인
- `npm run test:ontology-action-validator`: 2 passed
- `npm run test:ontology-action-contract`: 5 passed
- `npm run test:ontology-action-migration`: 3 passed
- `npm run test:admin-copilot`: 12 passed
- `npm run typecheck`: passed
- `npm run lint`: passed with existing warnings 3건
- `npm run build`: passed with the same existing warnings 3건
- `git diff --check`: passed

2026-08-05 ReviewMaterial Task 5 구현·focused 검증:

- `src/services/admin-copilot-logic.ts`에 pending material 전용 `review_material`·`always_required` action metadata와 target `updated_at`, bounded proposal `id/status`를 추가
- `src/services/admin-copilot.ts`에서 현재 workspace의 pending material proposal을 150개 ID 단위로 batch-load하고, 현재 material version의 SHA-256 fingerprint와 일치하는 proposal만 task context에 연결
- 일반 Admin Copilot briefing read는 proposal을 생성·변경하지 않으며, 출석·피드백·수업 종료 task에는 action metadata를 추가하지 않음
- `scripts/admin-copilot-logic.test.mjs`: action metadata, 현재 task 유형 제한, proposal 상태 노출을 검증
- `npm run test:admin-copilot`: 13 passed
- `npm run test:ontology-action-contract`: 5 passed
- `npm run test:ontology-action-validator`: 2 passed
- `npm run test:ontology-action-migration`: 3 passed
- `npm run test:ontology-contract`: 3 passed
- `npm run test:developer-qa`: 3 passed
- `npm run typecheck`: passed
- `npm run lint`: passed with existing warnings 3건
- `npm run build`: passed with the same existing warnings 3건
- `git diff --check`: passed

2026-08-05 ReviewMaterial Task 6 구현·focused 검증:

- `src/components/admin-copilot/review-material-action-dialog.tsx`에 owner-only 자료 검토 dialog를 추가: 자료 다운로드, 관련 관리 화면, 공개 범위·기준 버전·판단 근거 표시
- dialog 진입 자체는 무변경이며 `검토 시작`을 눌렀을 때만 `ensureReviewMaterialProposal`을 호출
- proposal 생성 후 `확인됨으로 변경` 또는 `제안 거절`을 명시적으로 호출하고, 선택 메모·loading·stale·replay·failure·success 상태를 표시
- 승인/거절 후 `router.refresh()`로 approved task는 제거하고 rejected task는 미확인 상태로 유지
- server action이 owner membership과 proposal/material 현재 상태를 다시 검증하므로 UI 숨김은 권한 경계가 아님
- `npm run test:admin-copilot`: 13 passed
- `npm run test:ontology-action-contract`: 5 passed
- `npm run test:ontology-action-validator`: 2 passed
- `npm run test:ontology-action-migration`: 3 passed
- `npm run test:ontology-contract`: 3 passed
- `npm run test:developer-qa`: 3 passed
- `npm run typecheck`: passed
- `npm run lint`: passed with existing warnings 3건
- `npm run build`: passed with the same existing warnings 3건
- `git diff --check`: passed

2026-08-05 ReviewMaterial Task 7 local 검증:

- `supabase db reset`: 현재 branch의 migration 전체와 `20260805090000_ontology_action_review_material.sql` 적용 passed
- `npm run verify:ontology-action:local`: local Auth 3계정 sign-in, rejection, stale expiry, fresh approval, replay, execution 1건, signal 해소, non-owner ledger 차단 passed
- 실제 local run에서 JS millisecond canonicalization과 PostgreSQL microsecond 비교 불일치를 발견해 RPC를 millisecond precision으로 수정하고 재검증 passed
- `docker exec supabase_db_DURE psql ... scripts/ontology-action-review-material.contract.sql`: approval/replay/rejection/stale/before-after/RLS contract passed; transaction rollback 확인
- `npm run verify:developer-qa:local`: baseline 복원 후 passed
- `npm run typecheck`: passed
- `npm run lint`: passed with existing warnings 3건
- `npm run build`: passed with the same existing warnings 3건
- `curl -L -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/`: 200
- Computer Use browser: owner login, workspace home, 4개 briefing task, dialog-only 상태 proposal 0건, `검토 시작` 후 pending proposal 저장, refresh 후 `검토 이어가기` 표시까지 확인
- browser UI의 rejection/stale/approval click sequence와 group-admin/instructor 화면 전환은 Computer Use AX click 불안정으로 미완료

## 다음 검증 단계

현재 코드·순수 규칙·정적 계약·production build는 확인되었다. 다음 release 단계에서는 Docker Desktop과 로컬 Supabase를 기동한 뒤 owner/group-admin/instructor 계정으로 실제 workspace home, 수평 수업 필터, 출석부 이동, 역할별 course scope를 브라우저와 DB에서 검증한다. 그 후 승인된 migration을 별도 QA 환경에 적용하고 RLS·persistence를 확인한다. SMS 발송과 출석 추이 그래프는 현재 범위에 포함하지 않는다.

## Blocker / 미검증

- local-first 명령은 `supabase status`에서 연결 정보를 읽고 고정된 로컬 전용 workspace ID와 비밀번호를 사용하므로 별도 QA 환경변수가 필요하지 않습니다. 원격 reset에는 기존 allowlist와 환경변수 안전장치가 유지됩니다.
- 과거 ReviewMaterial browser 검증에서는 owner의 proposal 생성·재진입까지 확인했지만 rejection/stale/approval mutation 전체와 non-owner 화면 전환은 미검증으로 남았다. 해당 기능이 retired되어 현재 release blocker는 아니다.
- 2026-08-31에 기록된 production 배포 이후의 현재 live 상태는 이번 checkout에서 다시 확인하지 않았습니다.
- 이번 운영 범위 정리 후 retired public/feedback/settlement route의 실제 브라우저 404와 레거시 event 비노출은 focused source test로 확인했으며, 실행 중인 앱의 브라우저 smoke는 아직 미검증입니다.
- 자동 테스트는 순수 규칙 로직과 group-derived projection, 중복 제거, 명시 제외, 삭제 상태, 1,000행 초과 pagination, query 오류 전파를 검증합니다. 실제 Supabase query, 멤버십 권한, home 통합을 포함하는 service/integration test는 아직 없습니다.
- LLM phrasing을 추가하려면 provider, 비용, permission-filtered input contract를 먼저 결정해야 합니다.
- `20260902090000_retire_non_operational_surfaces.sql`은 추가했지만, 현재 local DB reset 적용과 원격 staging/production 적용은 아직 미검증입니다. 적용 시 기존 피드백·정산 행과 영수증 객체를 보존하는지, 정산/영수증/public-material anonymous policy가 종료되는지 확인해야 합니다.
- 과거 `ReviewMaterial` Task 1 DB foundation부터 Task 7 local verifier까지의 검증 기록은 보존하지만, 해당 기능은 현재 retired 상태라 active release criterion이 아닙니다.
- 과거 RPC의 millisecond timestamp canonicalization 경계는 historical migration evidence로 보존합니다. 새 기능에서 재사용할 때는 현재 service/API 계약을 다시 확인합니다.

## 기준 문서

- Agent 작업 규칙: `AGENTS.md`
- 용어: `docs/context.md`
- 구조: `docs/architecture.md`
- API와 화면 계약: `docs/api-spec.md`
- Operational ontology historical reference: `docs/ontology.md`
- Operational ontology 공통 계약: `docs/ontology-contract.md`
- Developer QA: `docs/developer-qa.md`

## 상태 관리 원칙

- 현재 작업 상태, 검증, blocker, 다음 시작점은 이 파일에서만 관리합니다.
- 실제 코드와 테스트 결과가 이 문서보다 우선합니다.
- 개인 학습 상태는 repository가 아니라 Knowledge Debt Vault의 `DURE/learning.md`에서 관리합니다.
