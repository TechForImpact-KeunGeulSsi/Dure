// Keep API labels aligned with the product's public terminology.
// Pages convert API enum values to Korean labels through these helpers
// rather than baking strings into UI code.

import type {
  AttendanceStatus,
  CourseFeedbackCategory,
  CourseFeedbackStatus,
  CourseStatus,
  GroupStatus,
  MaterialReviewStatus,
  MaterialVisibilityScope,
  MemberStatus,
  ParticipantStatus,
  SessionProgressStatus,
  SessionRollupStatus,
  SessionType,
  SessionVisibilityStatus,
  SettlementRequestStatus,
  WorkspaceRole,
} from "./types";

export function workspaceRoleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "owner_admin":
      return "대표 운영자";
    case "group_admin":
      return "그룹 운영자";
    case "instructor":
      return "강사";
  }
}

export function groupStatusLabel(status: GroupStatus): string {
  return status === "active" ? "활성" : "비활성";
}

export function participantStatusLabel(status: ParticipantStatus): string {
  switch (status) {
    case "active":
      return "활성";
    case "inactive":
      return "비활성";
    case "deleted":
      return "삭제됨";
  }
}

export function memberStatusLabel(status: MemberStatus): string {
  switch (status) {
    case "active":
      return "활성";
    case "invited":
      return "초대 대기";
    case "disabled":
      return "비활성";
    case "removed":
      return "제거됨";
  }
}

export function courseStatusLabel(status: CourseStatus): string {
  switch (status) {
    case "planned":
      return "진행 전";
    case "in_progress":
      return "진행 중";
    case "completed":
      return "진행 완료";
  }
}

export function courseFeedbackCategoryLabel(
  category: CourseFeedbackCategory,
): string {
  switch (category) {
    case "suggestion":
      return "제안";
    case "praise":
      return "좋았던 점";
    case "other":
      return "기타";
  }
}

export function courseFeedbackStatusLabel(status: CourseFeedbackStatus): string {
  switch (status) {
    case "new":
      return "미확인";
    case "reviewed":
      return "확인됨";
  }
}

export function materialVisibilityLabel(scope: MaterialVisibilityScope): string {
  switch (scope) {
    case "public":
      return "전체 공개";
    case "admin_only":
      return "관리자에게만 공개";
  }
}

export function materialReviewStatusLabel(status: MaterialReviewStatus): string {
  switch (status) {
    case "pending":
      return "미확인";
    case "reviewed":
      return "확인됨";
  }
}

export function attendanceStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case "present":
      return "출석";
    case "partial":
      return "지각";
    case "absent":
      return "결석";
  }
}

export function sessionTypeLabel(type: SessionType): string {
  switch (type) {
    case "regular":
      return "정규";
    case "makeup":
      return "보충";
    case "special":
      return "특강";
    case "practice":
      return "실습";
  }
}

export function sessionVisibilityLabel(status: SessionVisibilityStatus): string {
  return status === "visible" ? "표시" : "숨김";
}

export function sessionRollupLabel(status: SessionRollupStatus): string {
  return status === "included" ? "포함" : "제외";
}

export function sessionProgressLabel(status: SessionProgressStatus): string {
  return status === "scheduled" ? "예정" : "취소";
}

export function settlementStatusLabel(status: SettlementRequestStatus): string {
  switch (status) {
    case "pending":
      return "대기";
    case "paid":
      return "지급 완료";
  }
}
