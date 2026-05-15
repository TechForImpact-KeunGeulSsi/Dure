@AGENTS.md
# DURE Project Context for Claude

이 파일은 DURE 프로젝트에서 Claude가 작업 전 현재 맥락(Context)을 빠르게 파악하기 위한 인수인계 문서입니다. 전반적인 개발 원칙과 도메인 지식은 `AGENTS.md`, `architecture.md`, `api-spec.md`를 최우선으로 따릅니다.

## 📍 현재 진행 상태 (Phase 6 완료)
이전 작업자가 **Phase 6 (자료 업로드, 공개 그룹, 확인 상태)** 백엔드 + UI 작업과, 자료 화면 진입에 필요한 주변 mock 정리까지 마무리했습니다.
* **완료된 경로:**
  * `src/services/materials.ts` — api-spec.md §11의 7개 계약 + 운영 편의용 `deleteMaterial`까지 구현.
  * `src/services/course-detail.ts` — 수업 상세 헤더용 단건 조회 (`getCourseDetail`). `can_manage_full_course` RPC로 `canUpdateVisuals` 판정.
  * `src/lib/validators/material.ts` — Zod 스키마 4종 + 정책 헬퍼.
  * `src/app/api/materials/upload-url/route.ts`, `src/app/api/materials/[materialId]/download/route.ts` — Route Handler 2종.
  * `src/app/workspaces/[workspaceId]/(dashboard)/courses/[courseId]/materials/*` — 자료 탭 UI 6개 파일 (page/materials-client/material-row/visibility-fields/upload-dialog/edit-dialog).
  * `src/app/workspaces/[workspaceId]/(dashboard)/home/page.tsx` — 대시보드 홈을 mock에서 실 DB(`getCoursesPage`)로 전환. `home-client.tsx`는 그대로 사용.
  * `src/app/workspaces/[workspaceId]/(dashboard)/courses/[courseId]/layout.tsx` — 수업 상세 헤더를 mock에서 실 DB(`getCourseDetail`)로 전환. 수업 없으면 `notFound()`.

* **특이사항:**
  * **단계 5 mock이 남아 있는 곳:** `courses/[courseId]/home/page.tsx`(수업 홈 탭)와 `courses/[courseId]/participants/page.tsx`(참여자 현황 탭)는 여전히 `services/courses-mock.ts`를 사용합니다. mock의 fallback이 어떤 UUID에도 디폴트 데이터를 돌려주므로 화면은 채워져 보이지만, 단계 7에서 실 DB로 일괄 전환하는 것이 다음 우선순위입니다.
  * **`review_status='pending'` 자동 복귀**는 서비스 코드가 아니라 DB 트리거(`reset_material_review_status`, `reset_material_review_status_after_group_change`)가 책임집니다. update 코드 추가 시 트리거 발동 조건과 컬럼 변화를 함께 고려해 주세요.
  * **`material_groups` insert에 admin client를 사용하는 우회 패턴**이 있습니다(`services/materials.ts` → `insertMaterialGroups`). 강사가 자기 수업 자료를 업로드할 때 RLS `course managers can manage material groups`를 통과시키기 위함이며, DB 트리거 `ensure_material_group_is_course_group`이 정합성을 강제합니다.
  * **`materials` 테이블에 DELETE 정책이 없어** `deleteMaterial`도 admin client로 처리합니다. 권한 체크(`canEditMaterial`)는 서비스 코드에서 수행합니다.

## 🚀 다음 목표 (Phase 7 진입)
당신이 맡게 될 다음 작업은 **Phase 7: 강사 콘솔의 자료, 출석부, 수업 메모 구현**입니다.
* **타겟 경로:** 강사 시점의 수업 콘솔. 운영자용 수업 상세와 라우트가 분기될 가능성이 높습니다(구조는 architecture.md §4와 api-spec.md §13~§15 참고).
* **주요 기능:**
  * 강사용 자료 화면 — Phase 6 서비스(`getCourseMaterials`, `prepareMaterialUpload`, …)를 재사용. 권한 플래그(`canEdit`/`canDownload`)가 이미 강사 케이스를 처리합니다.
  * 출석부 — 회차별 출석 상태 입력 (api-spec.md §14).
  * 수업 메모 — 회차 단위 메모 작성 (api-spec.md §15).
* **함께 정리할 mock 잔존 부분:**
  * `courses/[courseId]/home/page.tsx` — `getCourseHomePageData`(mock) → 실 DB. 회차 목록 조회는 `course_sessions` 테이블에서. layout이 이미 실 DB로 갔으므로 같은 service 경로(`services/course-detail.ts` 또는 새 `services/sessions.ts`)에 자연스럽게 추가됩니다.
  * `courses/[courseId]/participants/page.tsx` — `getCourseParticipantsStatus`(mock) → api-spec.md §12.1의 실 구현.
* **참고 스펙:** `api-spec.md`의 §13(강사 콘솔), §14(출석), §15(수업 메모)를 준수해 Route Handler 또는 Server Action을 구현해야 합니다.

작업 시작 전, Phase 5/6 공통 UI 컴포넌트(`components/ui/...`)와 페이지 패턴(서버 컴포넌트 + 클라이언트 컴포넌트 분리, `services/`를 통한 데이터 접근)을 그대로 따라 주세요. 강사 권한 RLS는 `can_access_course`, `can_access_session` 같은 RPC가 이미 준비되어 있어 서비스 코드는 그 위에서 단순화할 수 있습니다.