# 제출용 저장소 공개 범위

이 문서는 DURE `main` GitHub 링크를 외부 감사·제출에 사용할 때의 공개 범위를 고정합니다.

## 제출하는 내용

- DURE의 제품 코드와 화면·서비스 구조
- Supabase schema/RLS migration
- 결정론적 Admin Copilot 규칙과 ontology/action 계약
- local QA fixture, 테스트, typecheck·lint·build 재현 경로
- 현재 구현 상태와 아직 검증하지 못한 한계

## 제출하지 않는 내용

- 기관 담당자의 이름·이메일·전화번호·개별 연락 이력
- Google Meet 링크, 미팅 원본, 녹음·녹취와 실제 인터뷰 메모
- 실제 참여자 개인정보, 장애·건강·연락처 정보와 실제 출석/보고 파일
- 외부 서비스 credential, token, `.env.local`과 로컬 도구 상태
- 과거 발표자료, 임시 screenshot, 폐기된 기획 산출물

PM 사용자 조사 원본과 접촉 기록은 제품 코드와 분리해 관리합니다. 제출 설명에는 기관별 연락처 대신 후보 탐색 규모, 인터뷰에서 확인한 운영 문제, 제품 방향의 변화처럼 비식별화된 결과만 사용합니다.

## 감사자가 먼저 볼 파일

1. `README.md`: DURE의 목적, 현재 구현, AI 준비 범위와 한계
2. `docs/STATUS.md`: 최근 구현·검증·blocker
3. `docs/architecture.md`: 시스템과 권한 구조
4. `docs/ontology-contract.md`: 객체·관계·권한·action·evidence 계약
5. `docs/developer-qa.md`: local fixture와 재현 가능한 확인 방법
