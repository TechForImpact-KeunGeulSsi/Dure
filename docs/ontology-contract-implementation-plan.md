# DURE Operational Ontology Contract Implementation Plan

## 1. 목표

현재 Operational Ontology v1의 객체, 속성, 링크, 상태, 원본 컬럼, 권한, 추천 근거를 하나의 공통 계약으로 고정한다.

새 Admin Copilot task를 추가하는 구현자는 이 계약에서 대상 객체와 canonical link path, 상태 필터, actor scope, evidence source를 선택하고, 기존 조인을 처음부터 다시 해석하지 않는다.

## 2. 기준선과 범위

기준선은 현재 checkout의 다음 실제 경로다.

- 도메인 용어: `docs/context.md`
- 현재 ontology 설명: `docs/ontology.md`
- DB source of truth: `supabase/migrations/`
- 권한 경계: `src/services/access.ts`와 각 service의 permission check
- 추천 데이터 경로: `src/services/admin-copilot.ts`
- 추천 규칙과 evidence projection: `src/services/admin-copilot-logic.ts`
- 수업 참여자 파생 규칙: `src/services/admin-copilot-participant-projection.ts`, `src/services/attendance.ts`, `src/services/course-participants.ts`

이번 작업은 현재 ontology가 이미 정의한 11개 객체에 한정한다.

1. `Workspace`
2. `WorkspaceMember`
3. `Group`
4. `Participant`
5. `Course`
6. `CourseSession`
7. `Material`
8. `AttendanceRecord`
9. `ClassMemo`
10. `CourseFeedback`
11. `ActivityLog`

현재 Admin Copilot이 생성하는 네 task만 추천 계약으로 고정한다.

1. `pending_material_review`
2. `attendance_risk_participant`
3. `new_course_feedback`
4. `course_completion_candidate`

정산, 초대, 일반 일정 등 ontology v1에 포함되지 않은 객체를 이번 계약에 임의로 추가하지 않는다. DB schema, RLS, 서비스 동작도 변경하지 않는다.

## 3. 구현 산출물

### 3.1 공통 계약 문서

`docs/ontology-contract.md`에 다음 표를 둔다.

- 객체 계약표: 객체 의미, identity, tenant key, 원본 table, 상태 축, canonical service owner
- 속성 계약표: semantic property와 정확한 source `table.column`, 타입/nullable, 해석 규칙
- 링크 계약표: link 이름, from/to, source/junction, from 관점과 to 관점 cardinality, canonical join path
- 예외 규칙표: soft delete, active membership, group-derived course participation, explicit exclusion, legacy snapshot, nullable instructor, optional activity target
- 역할별 접근 범위표: `owner_admin`, `group_admin`, `instructor`, participant data subject의 read/action scope와 service 재검증 경계
- 추천 provenance 표: task, deterministic condition, 원본 column, join path, evidence entity, 관리 화면 경로, 권한 gate

문서는 DB row 전체를 외부 출력 계약으로 취급하지 않는다. source mapping과 permission-filtered projection을 분리하고, evidence는 authorization이 아님을 명시한다.

### 3.2 기존 문서 연결

- `docs/context.md`에는 구현 세부 없이 `운영 객체`, `관계 링크`, `추천 근거`, `원본 데이터 경로`의 canonical 용어만 추가한다.
- `docs/ontology.md`는 상세 source/join 계약의 canonical 위치로 `docs/ontology-contract.md`를 가리킨다.
- `GraphContext`는 현재 구현이 아니라 future contract이고, 현재 런타임 출력은 `AdminCopilotTask`/`AdminCopilotEvidence`임을 분명히 한다.

### 3.3 계약 검증

- `scripts/ontology-contract.test.mjs`에서 필수 객체, 링크, 상태, source path, 추천 task가 계약 문서에 모두 존재하는지 확인한다.
- migration과 현재 Admin Copilot service/logic에 계약이 참조한 핵심 table·column·task identifier가 실제 존재하는지 확인한다.
- `package.json`에 좁은 범위의 `test:ontology-contract` 명령을 추가한다.

## 4. 구현 순서

1. migration의 최종 schema와 composite foreign key/unique constraint를 기준으로 객체·속성·링크 초안을 만든다.
2. service query와 pure rule을 따라 네 추천의 raw source path를 역추적한다.
3. 권한 표는 RLS 설명만 복사하지 않고, 실제 service의 인증 → 활성 membership → role/scope 확인 → 필요 시 admin client 순서를 기록한다.
4. 표 사이의 이름과 cardinality를 교차검증하고 계약 문서를 작성한다.
5. glossary와 기존 ontology 문서를 최소 변경으로 연결한다.
6. 계약 검증 test, 기존 Admin Copilot test, typecheck, lint, build를 실행한다.

## 5. 완료 조건

다음을 모두 만족해야 완료다.

- 11개 객체 각각의 identity, 주요 속성/상태, source table·column이 표로 확인된다.
- 모든 ontology v1 링크에 양방향 cardinality와 예외 규칙이 있다.
- 수업 참여자 파생 경로가 `course_groups -> participant_groups -> participants`, `course_participants.status='excluded'` 제외로 한 번만 canonical하게 정의된다.
- 세 역할과 participant data subject의 접근 범위가 object/scope/action 관점에서 구분된다.
- 네 추천 각각에 `권한 gate -> source query -> deterministic rule -> evidence -> related screen` 경로가 있다.
- 새 task 작성자가 문서의 재사용 절차만으로 대상 객체, 링크, 상태, source column, 권한 gate, evidence path를 선택할 수 있다.
- 계약 검증 test와 기존 관련 test/typecheck/lint/build의 실제 결과를 보고한다.

## 6. 비목표

- generic graph database, RDF/OWL, EAV schema 추가
- 새 recommendation 또는 action 구현
- 기존 권한 정책이나 RLS 변경
- 기존 service 조인의 대규모 refactor
- `GraphContext` runtime 도입
- 배포, commit, push
