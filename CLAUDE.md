@AGENTS.md
# DURE Project Context for Claude

이 파일은 DURE 프로젝트에서 Claude가 작업 전 현재 맥락(Context)을 빠르게 파악하기 위한 인수인계 문서입니다. 전반적인 개발 원칙과 도메인 지식은 `AGENTS.md`, `architecture.md`, `api-spec.md`를 최우선으로 따릅니다.

## 📍 현재 진행 상태 (Phase 5 완료)
이전 작업자가 **Phase 5 (수업 상세 + 일정 관리 캘린더)** UI 및 Mock 데이터 연동 작업을 성공적으로 마무리했습니다. 
* **완료된 경로:** * `app/workspaces/[workspaceId]/(dashboard)/home` (수업 필터 및 버튼 위치 개편)
  * `app/workspaces/[workspaceId]/(dashboard)/courses/[courseId]/*` (수업 홈, 참여자 현황 탭)
  * `app/workspaces/[workspaceId]/(dashboard)/calendar` (월간 캘린더 뷰)
* **특이사항:** 아직 백엔드 API가 연동되지 않아 임시 더미 데이터(Mock)로 UI만 렌더링 중입니다. 수업 자료 탭(`/materials`)은 의도적으로 비워두었습니다.

## 🚀 다음 목표 (Phase 6 진입)
당신이 맡게 될 다음 작업은 **Phase 6: 자료 업로드, 공개 그룹, 확인 상태 구현**입니다.
* **타겟 페이지:** 수업 상세의 `수업 자료` 탭 (`courses/[courseId]/materials/page.tsx`).
* **주요 기능:** 파일 업로드 준비(signed URL 발급), 업로드 완료 확정, 공개 그룹 범위 설정, 운영자의 자료 확인 상태(pending -> reviewed) 변경.
* **참고 스펙:** `api-spec.md`의 **§11 (수업 자료)** 계약을 준수하여 Route Handler 및 Server Action을 구현해야 합니다.

작업을 시작하기 전, Phase 5에서 구현된 기존 공통 UI 컴포넌트(`components/ui/...`)와 `CourseDetailTabs` 레이아웃을 해치지 않는 선에서 확장을 진행해 주세요.