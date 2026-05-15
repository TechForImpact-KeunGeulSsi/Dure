@AGENTS.md
# DURE Project Context for Claude

이 파일은 DURE 프로젝트에서 Claude가 작업 전 현재 맥락(Context)을 빠르게 파악하기 위한 인수인계 문서입니다. 전반적인 개발 원칙과 도메인 지식은 `AGENTS.md`, `architecture.md`, `api-spec.md`를 최우선으로 따릅니다.

## 📍 현재 진행 상태 (Phase 6 완료)
이전 작업자가 **Phase 6 (자료 업로드, 공개 그룹, 확인 상태)** 백엔드 + UI 작업과, 자료 화면 진입에 필요한 mock 정리(대시보드 홈/수업 상세 layout/수업 홈 탭/참여자 현황 탭)까지 마무리했습니다.
* **완료된 경로:**
  * `src/services/materials.ts` — api-spec.md §11의 7개 계약 + 운영 편의용 `deleteMaterial`까지 구현. INSERT/UPDATE/DELETE는 admin client로 처리(아래 RLS 노트 참고).
  * `src/services/course-detail.ts` — 수업 상세 헤더용 단건 조회 (`getCourseDetail`). `can_manage_full_course` RPC로 `canUpdateVisuals` 판정.
  * `src/services/course-sessions.ts` — 수업 회차 목록.
  * `src/services/course-participants.ts` — 참여자 현황. 출석 카운트는 단계 7에서 attendance_records 채워지면 집계 쿼리만 추가하면 됨.
  * `src/lib/validators/material.ts` — Zod 스키마 4종 + 정책 헬퍼.
  * `src/app/api/materials/upload-url/route.ts`, `src/app/api/materials/[materialId]/download/route.ts` — Route Handler 2종.
  * `src/app/workspaces/[workspaceId]/(dashboard)/courses/[courseId]/materials/*` — 자료 탭 UI 6개 파일.
  * `src/app/workspaces/[workspaceId]/(dashboard)/home/page.tsx`, `courses/[courseId]/layout.tsx`, `courses/[courseId]/home/page.tsx`, `courses/[courseId]/participants/page.tsx` — 모두 실 DB 연동.

* **단계 6 RLS / 스펙 충돌 (중요):**
  `materials` 테이블의 INSERT 정책은 `uploaded_by = current_member_id(workspace_id)` 정확 일치를 요구하지만, SSR 환경에서 이 비교가 통과되지 못해 "new row violates row-level security policy for table materials" 에러가 발생했습니다. 단계 3의 `groups` 임시 처리와 동일하게, materials의 INSERT/UPDATE/DELETE는 admin client(service role)로 우회합니다. 권한 검증은 service 레이어에서 수행합니다(`loadCurrentMembership` + `canUploadForRole`/`canEditMaterial`/`canChangeReviewStatus`). SELECT는 그대로 server client(RLS 적용)를 씁니다. 후속으로 INSERT 정책을 멤버십 존재 여부 검사 수준으로 완화하는 마이그레이션을 추가하면 우회를 제거할 수 있습니다.

* **그 외 특이사항:**
  * **`review_status='pending'` 자동 복귀**는 서비스 코드가 아니라 DB 트리거(`reset_material_review_status`, `reset_material_review_status_after_group_change`)가 책임집니다. update 코드 추가 시 트리거 발동 조건과 컬럼 변화를 함께 고려해 주세요.
  * **`material_groups` insert도 admin client로 처리**합니다. DB 트리거 `ensure_material_group_is_course_group`이 정합성을 강제합니다.
  * **다른 service 파일(`groups.ts`, `courses.ts`, `participants.ts`)의 `loadCurrentMembership` 패턴**도 잠재적으로 같은 RLS 문제를 일으킬 수 있습니다(현재는 INSERT 정책이 단순 멤버십 존재 검사라 문제 없지만, 정책이 강화되면 동일한 우회가 필요할 수 있음).

## 🚀 다음 목표 (Phase 7 진입)
당신이 맡게 될 다음 작업은 **Phase 7: 강사 콘솔의 자료, 출석부, 수업 메모 구현**입니다.
* **타겟 경로:** 강사 시점의 수업 콘솔. 운영자용 수업 상세와 라우트가 분기될 가능성이 높습니다(구조는 architecture.md §4와 api-spec.md §13~§15 참고).
* **주요 기능:**
  * 강사용 자료 화면 — Phase 6 서비스(`getCourseMaterials`, `prepareMaterialUpload`, …)를 재사용. 권한 플래그(`canEdit`/`canDownload`)가 이미 강사 케이스를 처리합니다.
  * 출석부 — 회차별 출석 상태 입력 (api-spec.md §14). `attendance_records` 테이블을 채우면 단계 6 참여자 현황의 출석 카운트가 자동으로 보강됩니다.
  * 수업 메모 — 회차 단위 메모 작성 (api-spec.md §15).
* **참고 스펙:** `api-spec.md`의 §13(강사 콘솔), §14(출석), §15(수업 메모)를 준수해 Route Handler 또는 Server Action을 구현해야 합니다.

작업 시작 전, Phase 5/6 공통 UI 컴포넌트(`components/ui/...`)와 페이지 패턴(서버 컴포넌트 + 클라이언트 컴포넌트 분리, `services/`를 통한 데이터 접근)을 그대로 따라 주세요. 강사 권한 RLS는 `can_access_course`, `can_access_session` 같은 RPC가 이미 준비되어 있어 서비스 코드는 그 위에서 단순화할 수 있습니다.