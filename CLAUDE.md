@AGENTS.md
# DURE Project Context for Claude

이 파일은 DURE 프로젝트에서 Claude가 작업 전 현재 맥락(Context)을 빠르게 파악하기 위한 인수인계 문서입니다. 전반적인 개발 원칙과 도메인 지식은 `AGENTS.md`, `architecture.md`, `api-spec.md`를 최우선으로 따릅니다.

## 📍 현재 진행 상태 (Phase 6 완료)
이전 작업자가 **Phase 6 (자료 업로드, 공개 그룹, 확인 상태)** 백엔드 + UI 작업을 마무리했습니다.
* **완료된 경로:**
  * `src/services/materials.ts` — api-spec.md §11의 7개 계약 모두 구현 (`getCourseMaterials`/`prepareMaterialUpload`/`completeMaterialUpload`/`updateMaterial`/`replaceMaterialFile`/`updateMaterialReviewStatus`/`getMaterialDownloadUrl`).
  * `src/lib/validators/material.ts` — Zod 스키마 4종 + 정책 헬퍼.
  * `src/app/api/materials/upload-url/route.ts`, `src/app/api/materials/[materialId]/download/route.ts` — Route Handler 2종.
  * `src/app/workspaces/[workspaceId]/(dashboard)/courses/[courseId]/materials/*` — 자료 탭 UI 6개 파일 (page/materials-client/material-row/visibility-fields/upload-dialog/edit-dialog).
* **특이사항:**
  * 자료 페이지 자체는 실제 Supabase + Storage와 연동되지만, **수업 상세 layout(`courses/[courseId]/layout.tsx`)은 여전히 mock(`getCourseHome`)을 사용**합니다. layout의 실 DB 전환은 단계 7과 함께 진행하는 것이 자연스럽습니다.
  * `review_status='pending'` 자동 복귀는 서비스 코드가 아니라 DB 트리거(`reset_material_review_status`, `reset_material_review_status_after_group_change`)가 책임집니다. update 코드 추가 시 트리거 발동 조건과 컬럼 변화를 함께 고려해 주세요.
  * `material_groups` insert에 admin client를 사용하는 우회 패턴이 있습니다(`services/materials.ts` → `insertMaterialGroups`). 강사가 자기 수업 자료를 업로드할 때 RLS `course managers can manage material groups`를 통과시키기 위함이며, DB 트리거 `ensure_material_group_is_course_group`이 정합성을 강제합니다.

## 🚀 다음 목표 (Phase 7 진입)
당신이 맡게 될 다음 작업은 **Phase 7: 강사 콘솔의 자료, 출석부, 수업 메모 구현**입니다.
* **타겟 경로:** 강사 시점의 수업 콘솔. 운영자용 수업 상세와 라우트가 분기될 가능성이 높습니다(구조는 architecture.md §4와 api-spec.md §13~§15 참고).
* **주요 기능:**
  * 강사용 자료 화면 — Phase 6 서비스(`getCourseMaterials`, `prepareMaterialUpload`, …)를 재사용. 권한 플래그(`canEdit`/`canDownload`)가 이미 강사 케이스를 처리합니다.
  * 출석부 — 회차별 출석 상태 입력 (api-spec.md §14).
  * 수업 메모 — 회차 단위 메모 작성 (api-spec.md §15).
* **참고 스펙:** `api-spec.md`의 §13(강사 콘솔), §14(출석), §15(수업 메모)를 준수해 Route Handler 또는 Server Action을 구현해야 합니다.

작업 시작 전, Phase 5/6 공통 UI 컴포넌트(`components/ui/...`)와 페이지 패턴(서버 컴포넌트 + 클라이언트 컴포넌트 분리, `services/`를 통한 데이터 접근)을 그대로 따라 주세요. 강사 권한 RLS는 `can_access_course`, `can_access_session` 같은 RPC가 이미 준비되어 있어 서비스 코드는 그 위에서 단순화할 수 있습니다.