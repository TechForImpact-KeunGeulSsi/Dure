# DURE 개발 워크플로

GitHub Issue → Planning → Implementation → Testing → Pull Request → Review → Merge를 기본 개발 절차로 사용한다. Branch·Commit·Push는 사용자가 GitHub Desktop에서 관리한다. Codex는 요구사항 분석, 구현, 검증, 코드 리뷰, Issue·PR 설명 초안을 담당하며, 원격 게시나 병합에는 별도 명시적 요청이 필요하다.

## 단계별 진행 조건

| 단계 | 수행할 작업 | 다음 단계로 넘어가는 조건 |
| --- | --- | --- |
| Issue | 기존 Feature Request 또는 Bug Report 양식으로 문제·목표·요구사항·완료 조건을 정의한다. | 검증 가능한 Acceptance Criteria와 제외 범위가 있다. |
| Planning | 관련 코드·설계 문서·ADR을 읽고, 구현 계획·영향받는 파일·테스트 계획을 Issue나 Codex 대화에 제시한다. | 범위와 검증 방법이 명확하며 중요한 설계 변경은 사용자가 승인했다. |
| Implementation | 하나의 주 Issue에 집중하고 기존 패턴을 사용한다. 변경 동작의 테스트와 현행 계약 문서를 함께 수정한다. | 구현과 문서가 일치하며 관련 없는 변경이 섞이지 않았다. |
| Testing | 변경 위험에 맞는 검증을 실행하고 각 완료 조건의 증거를 기록한다. | 필수 검증이 통과하고 미실행·실패·검증 한계가 명시되어 있다. |
| Pull Request | 사용자가 GitHub Desktop에서 diff를 확인하고 관련 파일만 Commit·Push한 뒤 PR을 연다. | PR 템플릿의 모든 절에 실제 내용이 있고 주 Issue가 연결되어 있다. |
| Review | Codex로 현재 PR diff와 Issue를 대조해 리뷰하고, 사용자가 결과와 최종 diff를 확인한다. | 병합을 막는 지적이 해결되고 마지막 수정 후 관련 검증과 리뷰가 완료되었다. |
| Merge | 사용자가 최신 PR의 체크·완료 조건·문서·위험을 확인하고 명시적으로 병합한다. | 기본 브랜치에 변경이 반영되고 연결된 Issue의 완료 조건이 충족된다. |

Issue가 없는 직접 요청은 그 요청을 임시 범위로 삼을 수 있다. Codex는 누락을 알리고 Issue 초안을 준비하며, 사용자가 PR 전에 Issue를 생성·연결한다. 형식만 채우기 위한 Issue 번호나 테스트 결과를 만들지 않는다. 미완료 검증은 Draft PR에서 기록할 수 있지만, 필수 검증이 남으면 병합 준비 완료로 표시하지 않는다.

## GitHub Desktop과 Codex의 역할

1. 사용자가 GitHub에서 Issue를 생성하고 Codex에 링크 또는 본문을 제공한다. 접근할 수 없는 Issue는 확인했다고 보고하지 않는다.
2. 사용자가 GitHub Desktop에서 최신 `main`을 기준으로 작업 브랜치를 만든다. 기본 이름은 `codex/<issue-number>-<short-description>`이다. 기존 작업이 있으면 먼저 확인하고 포함하거나 덮어쓰지 않는다.
3. Codex가 계획을 제시하고 구현·검증한다. 짧은 계획은 대화나 Issue로 충분하며 작업마다 계획 문서를 만들지 않는다.
4. 사용자가 GitHub Desktop에서 변경 파일과 diff를 확인하고 관련 파일만 Commit·Push한다. 기존 다른 작업은 별도로 유지한다.
5. 사용자가 GitHub Desktop에서 GitHub PR 화면으로 이동해 PR을 생성한다. Codex는 [PR 템플릿](.github/pull_request_template.md)에 맞춘 본문을 제공한다. 전체 Issue를 완료하면 `Closes #123`, 일부 작업이면 `Refs #123`으로 연결한다.
6. 사용자가 Codex에 PR 리뷰를 요청한다. Codex는 요구사항, 회귀, 권한·테넌트 경계, 테스트, 문서 정합성을 확인하고 파일·라인과 영향이 있는 지적을 제시한다. 지적이 없더라도 검증하지 못한 영역을 적는다.
7. 수정 후 사용자가 다시 Commit·Push하고 변경 영역을 재검증·재리뷰한다. 사용자가 GitHub에서 최종 병합한다. Codex 리뷰 결과는 GitHub의 사람 승인 수를 대신하지 않는다.

브랜치 생성·Commit·Push·Issue/PR 생성·외부 댓글·Merge·배포를 Codex에 맡기려면 각각 명시적으로 요청한다. 이 워크플로 구축 요청은 해당 원격 작업의 허가가 아니다.

## 설계 문서와 ADR

현재 구조는 [architecture](docs/architecture.md), API·DTO·query/action 계약은 [API](docs/api-spec.md), 데이터·권한 관계는 [ontology contract](docs/ontology-contract.md), 제품 문구는 [UI](docs/ui-system.md), 도메인 용어는 [context](docs/context.md)를 따른다. 현재 차이와 검증 한계는 [STATUS](docs/STATUS.md)에 있다. 계약과 코드가 다르면 그 차이를 확인하고 작업 범위 안에서 정본을 갱신한다.

중요한 기술 선택, 배포 모델, 데이터 소유권·모델, 권한 경계, 공개 API 계약, 되돌리기 어려운 의존성 변경은 구현 전에 사용자에게 대안과 영향을 제안한다. [ADR 템플릿](docs/decisions/template.md)을 복사해 `docs/decisions/0001-short-title.md`처럼 다음 순번으로 기록한다. 단순 버그 수정, 문구·스타일 수정, 기존 패턴을 따르는 구현에는 ADR이 필요하지 않다.

- Context, Decision, Alternatives, Trade-offs, Consequences를 기록한다.
- 상태는 `Proposed`로 시작하고, 명시적 승인 근거가 있을 때 `Accepted`로 기록한다. 보류·기각은 `Deferred`·`Rejected`로 구분한다.
- 승인된 ADR의 원래 결정·이유는 역사적 기록으로 보존한다. 중요한 결정 변경은 새 ADR에서 `Supersedes`로 이전 ADR을 참조한다. 이전 문서에는 상태·후속 ADR 링크만 보완할 수 있다.
- ADR 승인과 구현 완료는 구분한다. 구현된 동작은 같은 작업의 현재 설계/API 문서에 반영한다.
- 검토되지 않은 과거 설계를 소급하여 승인된 ADR로 만들지 않는다. 민감한 원문·비밀값을 ADR에 넣지 않는다.

## 검증과 증거 기록

Node.js 22.18 이상과 npm을 사용한다. 기존 [개발 환경](docs/setup.md)과 [개발자 QA](docs/developer-qa.md)의 명령을 재사용한다.

| 변경 범위 | 필요한 검증 |
| --- | --- |
| 문서·템플릿·지침 | 경로·링크·명령 확인, 변경한 YAML 등 구조 검사, `git diff --check` |
| 순수 로직·앱 동작 | 가장 가까운 성공·실패/회귀 테스트. TypeScript나 패키지 해석 변경은 `npm run typecheck`; 화면·번들 영향에 맞춰 lint/build 추가 |
| 테스트 러너·CI·검사 스크립트 | 해당 검사기의 실행 테스트와 실제 성공·실패 입력 검증 |
| 권한·RLS/RPC·Storage·migration | 관련 테스트와 로컬 Auth/DB/Storage 허용·거부 사례, 필요한 경우 다른 워크스페이스 접근 거부 및 인증 브라우저 검증 |

기존 `CI`의 `Verify` job은 Node 24에서 `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`를 수행한다. placeholder Supabase 값으로 실행하므로 DB migration 적용, RLS, Storage, 인증 브라우저, 배포·영속성을 증명하지 않는다. 필요한 검증을 수행하지 못하면 이유와 남은 작업을 적는다. `supabase db reset`이나 fixture 초기화 같은 데이터 삭제는 별도 승인 없이 실행하지 않는다.

PR의 Testing에는 다음처럼 **실제 실행한 명령·환경·결과**를 적는다. 미실행은 통과로 표시하지 않는다.

```text
node --test <관련 테스트 파일> | local / Node <실제 버전> | passed <실제 개수>
<수동 검증 시나리오> | <환경·역할·대상> | <관찰한 결과>
<필요하지만 미실행한 검증> | 미실행 | <이유와 병합 전 조치>
AC 1 → <구현 위치와 테스트/관찰 증거>
```

체크박스는 주장한 검증을 실제로 확인한 경우에만 체크한다. 해당 없음은 이유를 적고, 미실행·진행 중·실패는 그대로 남긴다. 모든 항목을 자동 체크하지 않는다. 필수 검증의 실패나 미완료는 해결 또는 명시적 범위 재합의 전까지 병합 차단 사유다.

## PR 자동 검사

[PR 본문 검사 workflow](.github/workflows/pr-policy.yml)의 `PR Policy` job은 `pull_request_target`의 생성·본문 수정·재개·새 커밋·리뷰 준비 전환 이벤트에서 필수 8개 절, 각 절의 내용, 같은 저장소 Issue 참조를 검사한다. 보호된 기본 브랜치의 workflow와 검사기만 실행하며 PR 코드를 checkout하거나 실행하지 않는다. 읽기 전용 권한을 사용하고 기존 `Verify` job과 테스트 실행을 중복하지 않는다.

기본 브랜치에 workflow가 반영된 뒤 GitHub Actions의 수동 실행에서 PR 번호를 지정해 같은 본문 검사를 재현할 수 있다. 최초 도입은 로컬 본문 검사·테스트·리뷰와 `Verify`를 완료한 PR로 진행하고, 병합 후 수동 `PR Policy` 실행을 확인한 다음 두 검사를 모두 필수로 등록한다. workflow가 없는 상태에서 `PR Policy`를 먼저 필수로 등록했다면, 최초 도입 PR 동안 그 항목만 일시 해제하고 `Verify`·PR 경유·관리자 적용·대화 해결 등 나머지 보호를 유지한다. 병합 후 새 검사 성공을 확인하면 즉시 두 필수 검사를 복구한다. 기존 필수 검사의 실패를 우회하는 용도로 이 절차를 사용하지 않는다.

로컬에서는 PR 본문을 Markdown 파일로 저장해 검사할 수 있다.

```bash
npm run check:pr -- /absolute/path/to/pr-body.md
```

저장소 전체 URL로 Issue를 연결할 때는 `GITHUB_REPOSITORY=owner/repository`도 지정한다. `#123` 형식은 같은 저장소 참조로 처리한다. 검사기는 Issue의 실재 여부, 테스트 결과의 진실성, 완료 조건 충족이나 리뷰 품질을 판정하지 않는다. 빈 체크박스는 허용한다. 해당 내용은 사용자와 리뷰어가 증거로 확인한다.

## GitHub에서 한 번 적용할 보호 설정

파일만으로 원격 병합 제한이 설정되지는 않는다. 저장소 관리자가 이 변경을 기본 브랜치에 반영한 뒤 GitHub Settings → Rules → Rulesets 또는 Branches에서 `main`에 다음 보호를 적용하고 실제 설정을 확인한다.

1. PR을 통한 병합을 요구하고 직접 push, force push, branch 삭제를 제한한다.
2. 실행 기록이 생긴 뒤 `Verify`와 `PR Policy`를 required status checks로 지정한다. GitHub에 표시된 check 이름을 확인하고 base 브랜치의 최신 변경에 대한 검증을 요구한다.
3. 리뷰 대화 해결을 요구한다. 다른 리뷰어가 참여할 수 있으면 최소 1명 승인을 요구하고 새 커밋 뒤 오래된 승인을 무효화한다. 단독 운영자는 자신의 PR을 승인할 수 없으므로 승인 수 대신 Codex 리뷰와 사용자 최종 확인을 기록한다.
4. 관리자·자동화 계정의 우회 권한을 확인하고 의도하지 않은 우회를 제한한다. Codex의 리뷰 완료를 사용자 병합 승인으로 해석하지 않는다.
5. 첫 PR에서 본문 수정 후 `PR Policy` 재실행, 새 커밋 후 두 검사 재실행, 검사 실패 시 병합 차단을 확인한다.

원격 보호 설정과 Actions 실행은 적용 후에만 검증 완료로 보고한다. 전체 Issue 완료 시 기본 브랜치 대상 PR의 `Closes`/`Fixes` 연결로 자동 종료하고, 일부 작업만 마쳤으면 Issue를 열어 둔다.

GitHub 동작 기준: [Issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms), [PR 이벤트](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request), [Issue 연결](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue), [브랜치 보호](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [리뷰 승인](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews).
