# DURE 팀 업무 흐름

이 문서는 공개된 DURE 저장소에서 PM, FDE, 개발자가 제품 업무를 넘겨받고 검증하는 최소 운영 규칙이다. 기관 관계의 원문과 개인정보는 별도의 접근 제한 Field Ops에 보관하고, 이 저장소에는 익명화된 제품 인사이트와 실행 가능한 제품 계약만 남긴다.

## 업무 상태

GitHub Project의 상태를 다음 순서로 사용한다.

```text
Inbox → Discovery → Ready for Development → In Progress → In Review → Staging QA → Done
```

- **Inbox**: 관찰·요청을 받았지만 문제와 담당자가 아직 정리되지 않음.
- **Discovery**: FDE/PM이 문제, 대상 사용자, 빈도, 기존 우회 방법을 확인함.
- **Ready for Development**: 개발자가 구현·검증할 수 있도록 범위와 완료 조건이 고정됨.
- **In Progress**: 담당 개발자가 짧은 브랜치에서 구현 중.
- **In Review**: PR, 자동 검증, 코드 리뷰를 진행 중.
- **Staging QA**: PM/FDE가 실제 사용자 흐름과 완료 조건을 확인 중.
- **Done**: 승인된 변경이 배포 가능한 기준 브랜치에 반영되고 후속 확인 계획이 남음.

### GitHub Project 설정

조직 Project 이름은 `DURE Product`로 하고 DURE 저장소에 연결한다. 최소 필드는 다음과 같다.

| 필드 | 형식 | 값 |
| --- | --- | --- |
| Workflow | Single select | Inbox, Discovery, Ready for Development, In Progress, In Review, Staging QA, Done |
| Type | Single select | Product, Research, Bug, Operations |
| Priority | Single select | P0, P1, P2, P3 |
| Evidence | Single select | Confirmed, Partial, Hypothesis |
| Effort | Single select | XS, S, M, L |
| Iteration | Iteration | 1주 단위 |
| Target date | Date | 배포 또는 판단 목표일 |

기본 view는 `Board`(Workflow 기준), `Backlog`(Inbox·Discovery·Ready 표), `Roadmap`(Target date 기준) 세 개만 유지한다. 새 Issue는 Inbox로 들어가며 담당자가 없는 Inbox 항목은 주간 Planning에서 정리한다.

## Definition of Ready

Issue를 `Ready for Development`로 옮기기 전에 다음을 모두 확인한다.

- 문제와 대상 사용자가 관찰 가능한 문장으로 적혀 있다.
- 기관·사람을 식별하는 정보가 제거되어 있다. 상세 원문은 비공개 Field Ops 기록 ID로만 참조한다.
- 문제의 근거와 검증 상태(확인됨/부분 확인/가설)가 구분되어 있다.
- 포함 범위와 제외 범위가 있다.
- 테스트 가능한 완료 조건이 있다.
- 권한, 데이터, migration, 외부 연동 위험이 검토되었다.
- Owner 한 명, 우선순위, 목표 iteration이 정해져 있다.

## Definition of Done

- 완료 조건을 모두 충족하고 관련 테스트가 추가·갱신되었다.
- PR에 Issue가 연결되고 코드 리뷰와 CI가 통과했다.
- DB migration/RLS/권한 변경을 실제 경로 기준으로 검토했다.
- Staging에서 PM이 요구사항을, FDE가 현장 흐름을 확인했다.
- Production 반영 여부와 남은 검증·모니터링 항목이 Issue에 기록되어 있다.
- 후속 기관 확인이 필요하면 별도 Research/Operations Issue로 연결했다.

## 역할별 매뉴얼

### PM

1. Inbox의 요청을 문제·대상 사용자·근거·범위로 정리한다.
2. 여러 기관의 관찰에서 공통 문제인지 확인하고 우선순위를 정한다.
3. 완료 조건과 제외 범위를 개발자와 함께 확정해 Ready로 이동한다.
4. Staging에서 사용자 흐름, 문구, 권한 기대치를 승인한다.
5. 무엇을 배포했고 무엇이 아직 검증되지 않았는지 기록한다.

### FDE / 기관 담당자

1. 비공개 Field Ops에서 기관 연락처, 일정, 미팅 원문, 파일럿 기록을 관리한다.
2. 관찰 사실과 해석·요청을 분리하고 기관은 익명 코드로 요약한다.
3. 반복 빈도·소요 시간·현재 우회 방법을 기록해 PM에게 전달한다.
4. 검증된 인사이트만 `Anonymized field insight` 또는 제품 요청 Issue로 옮긴다.
5. Staging/파일럿에서 실제 업무 흐름을 재현하고 후속 확인일을 관리한다.

### Developer

1. Ready Issue의 계약·권한·데이터 영향을 읽고 필요한 설계 질문을 남긴다.
2. 최신 `main`에서 `feat/<issue-number>-<short-name>` 또는 `fix/<issue-number>-<short-name>` 브랜치를 만든다.
3. 작은 단위로 구현하고 서비스 계층, validator, RLS 등 기존 경계를 따른다.
4. 테스트와 migration을 함께 작성하고 PR에서 변경하지 않은 범위도 설명한다.
5. 리뷰와 Staging QA 피드백을 반영한 뒤 PR을 merge 가능한 상태로 만든다.

### Reviewer / Tech Lead

1. Issue의 완료 조건과 실제 변경이 일치하는지 확인한다.
2. 권한 우회, 개인정보 노출, migration 안전성, 회귀 위험을 먼저 검토한다.
3. CI와 실제 실행 경로의 검증 결과를 확인하고 근거 없는 완료 표시를 막는다.
4. 필요한 변경을 PR에 남기고 승인 시 남은 위험을 명시한다.

## Issue–branch–PR 규칙

- 업무 하나당 추적 가능한 Issue 하나를 만든다. 구현 브랜치와 PR은 해당 Issue에 연결한다.
- 장기 PM worktree나 역할별 장기 브랜치를 만들지 않는다. worktree는 병렬 개발이 필요할 때만 임시로 사용한다.
- 브랜치는 최신 `main`에서 시작하고 하나의 목적만 포함한다.
- PR 제목과 본문에 `Closes #<issue-number>`를 사용하고, 테스트·권한·migration·Staging 확인을 적는다.
- `main`은 배포 가능한 기준 브랜치로 유지한다. 직접 push하지 않고 PR과 CI를 통과시킨다.
- 실제 팀 사용자와 리뷰어 정보가 정해지기 전에는 `CODEOWNERS`를 만들지 않는다. 이 저장소의 현재 blocker다.

### 저장소 보호 설정

`main`에는 직접 push하지 않고 다음 보호 규칙을 적용한다.

- Pull Request를 통해서만 변경한다.
- Review conversation이 모두 해결되어야 한다.
- CI의 `Verify`가 한 번 실제로 성공한 뒤 required status check로 지정한다.
- force push와 branch deletion을 허용하지 않는다.
- 독립 리뷰어가 없는 동안 approval 수는 0으로 시작하고, 두 번째 개발자가 합류하면 1로 올린다.
- 실제 reviewer GitHub 계정 또는 team이 확정되면 `CODEOWNERS`를 추가한다.

Issue Form이 사용하는 label은 `type:feature`, `type:bug`, `type:research`다. 원격 저장소에 이 label을 먼저 생성해야 자동 부착된다.

## 실험 규칙

- **문서/프로토타입 실험**: 코드 변경 없이 가설과 사용자 흐름을 검증한다.
- **Spike**: 기술 가능성만 확인하는 1–3일 작업이다. `spike/<issue-number>-<short-name>` 브랜치에서 하고 Production에 배포하지 않는다. 결과는 가능/불가능/위험으로 기록한다.
- **Feature flag 실험**: 기존 흐름을 기본값으로 두고 명시된 파일럿 workspace에만 새 동작을 켠다. Owner, 종료 조건, rollback 방법, flag 제거 Issue를 함께 적는다.
- 실험 데이터는 익명화하고, 개인정보나 실제 기관 원문을 테스트 fixture로 복사하지 않는다.

## 공개 저장소 정보보호

GitHub Issue/PR/커밋에는 기관명(공개 조사 출처가 아닌 경우), 담당자명·연락처·이메일, 미팅 원문·녹취, 참여자 개인정보, 계약·보안 정보, 토큰·쿠키·환경변수를 넣지 않는다. 필요하면 비공개 Field Ops의 기록 ID만 남기고 제품 인사이트는 익명화한다. 실수로 올라간 정보는 내용을 다시 인용하지 말고 즉시 접근 권한을 가진 관리자에게 삭제·회전 절차를 요청한다.

## 회의와 비동기 cadence

- **주간 Planning (30분)**: 지난 결과, 기관 피드백, 이번 주 1–3개 목표, Owner와 완료 조건을 확정한다.
- **비동기 진행 업데이트 (매일 또는 격일)**: 각 Issue에 완료/진행/막힘/다음 행동을 짧게 남긴다.
- **PR 리뷰**: 개발자 1명 이상 리뷰, 권한·DB 변경은 Tech Lead 확인, 사용자 흐름 변경은 PM 확인.
- **주간 Review (30분)**: Staging/Production 결과, 미검증 항목, 배포 후 기관 확인 계획을 확인한다.

회의에서 합의한 변경은 반드시 Issue, PR, 또는 비공개 Field Ops 기록으로 옮겨 단일한 추적 경로를 남긴다.
