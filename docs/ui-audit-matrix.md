# DURE UI Alignment Audit Matrix

이 표는 화면을 정렬할 때 확인할 기준 화면, 역할, 주요 업무, 공통 UI 계약을 한 곳에서 추적한다. 데이터·권한 계약은 [`docs/api-spec.md`](./api-spec.md)와 [`docs/context.md`](./context.md)를 따른다.

| 화면 | 사용자 | 주요 업무 | 기준 컴포넌트·패턴 | alignment 확인 항목 |
| --- | --- | --- | --- | --- |
| `/login`, `/signup`, `/accept-invite` | 비로그인 사용자·초대 사용자 | 인증·초대 수락 | 인증 brand mode, form, error | 업무에 필요한 label/error만 노출, 운영 화면 장식과 분리 |
| `/workspaces`, `/workspaces/new`, `/workspaces/discover` | 로그인 사용자 | 워크스페이스 선택·생성·참여 요청 | onboarding header, list, form/dialog | 워크스페이스와 멤버/참여자 용어 구분 |
| `/{workspaceId}/home` | 대표 운영자·그룹 운영자·강사 | 날짜별 출석 현황 확인 | dashboard, date control, course filter, status summary | 날짜·수업 범위·상태·출석률의 우선순위와 role scope |
| `/{workspaceId}/calendar` | 대표 운영자·그룹 운영자 | 회차·일반 일정 확인·관리 | calendar grid, side panel, form | 강사 미노출, 일정 상태와 빈 상태 일관성 |
| `/{workspaceId}/manage/groups` | 대표 운영자·그룹 운영자 | 그룹 목록·상태·설명 관리 | page header, filter, table, pagination, dialog | 상태 badge, 검색/필터, empty/error |
| `/{workspaceId}/manage/participants` | 대표 운영자·그룹 운영자 | 참여자 목록·그룹 배정 관리 | page header, filter, table, dialog | 참여자와 로그인 멤버 혼동 방지 |
| `/{workspaceId}/manage/courses` | 대표 운영자·그룹 운영자 | 수업 목록·상태 관리 | page header, filter, table/card, status badge | 수업 상태와 primary action |
| `/{workspaceId}/members` | 대표 운영자·그룹 운영자 | 운영자·강사 초대·권한 관리 | table, dialog, multi-select, status badge | 역할 범위, 초대 대기, 권한 action |
| `/{workspaceId}/courses/{courseId}/*` | 대표 운영자·그룹 운영자 | 수업 상세·자료·참여자 현황 | detail header, route tabs, surface/table | 운영자 탭과 수업 scope, 자료 확인 상태 |
| `/{workspaceId}/teach/courses/{courseId}/*` | 담당 강사 | 수업 자료·출석부·수업 메모 | instructor detail header, route tabs, form/table | 담당 수업만 노출, 운영자 전용 데이터 제외 |

## 공통 상태 확인

각 화면은 아래 상태를 같은 시각 계층으로 제공한다.

- loading: 사용자가 현재 기다리는 대상이 분명해야 한다.
- empty: 실제로 데이터가 없는 경우에만 사용하고, 설명성 문장을 덧붙이지 않는다.
- error: 결과와 사용자가 취할 수 있는 재시도·이동 action만 제공한다.
- disabled/pending: action의 현재 처리 상태를 표시한다.
- success: 저장 결과를 한 번만 알리고 중복 안내를 만들지 않는다.
- destructive confirmation: 영향과 확인 action만 짧게 표시한다.

## 카피 확인

- 모든 visible copy는 업무 대상, action, 상태, 범위, validation, 결과, 접근성 중 하나에 해당해야 한다.
- 화면 목적, 설계 의도, AI·에이전트 작업, 구현 과정만 설명하는 문구는 추가하지 않는다.
- 계약에 없는 새 helper text·tooltip·callout·badge는 만들지 않는다.
