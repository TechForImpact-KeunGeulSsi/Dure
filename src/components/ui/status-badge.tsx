import { Badge } from "./badge";

import type {
  CourseStatus,
  GroupStatus,
  MemberStatus,
  ParticipantStatus,
} from "@/lib/api/types";

type Tone = React.ComponentProps<typeof Badge>["tone"];

const GROUP_TONE: Record<GroupStatus, Tone> = {
  active: "success",
  inactive: "neutral",
};

const GROUP_LABEL: Record<GroupStatus, string> = {
  active: "활성",
  inactive: "비활성",
};

const PARTICIPANT_TONE: Record<ParticipantStatus, Tone> = {
  active: "success",
  inactive: "neutral",
  deleted: "danger",
};

const PARTICIPANT_LABEL: Record<ParticipantStatus, string> = {
  active: "활성",
  inactive: "비활성",
  deleted: "삭제됨",
};

const MEMBER_TONE: Record<MemberStatus, Tone> = {
  active: "success",
  invited: "warning",
  disabled: "neutral",
  removed: "danger",
};

const MEMBER_LABEL: Record<MemberStatus, string> = {
  active: "활성",
  invited: "초대 대기",
  disabled: "비활성",
  removed: "제거됨",
};

export function GroupStatusBadge({ status }: { status: GroupStatus }) {
  return <Badge tone={GROUP_TONE[status]}>{GROUP_LABEL[status]}</Badge>;
}

export function ParticipantStatusBadge({
  status,
}: {
  status: ParticipantStatus;
}) {
  return (
    <Badge tone={PARTICIPANT_TONE[status]}>{PARTICIPANT_LABEL[status]}</Badge>
  );
}

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  return <Badge tone={MEMBER_TONE[status]}>{MEMBER_LABEL[status]}</Badge>;
}

const COURSE_TONE: Record<CourseStatus, Tone> = {
  planned: "neutral",
  in_progress: "success",
  completed: "primary",
};

const COURSE_LABEL: Record<CourseStatus, string> = {
  planned: "진행 전",
  in_progress: "진행 중",
  completed: "진행 완료",
};

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  return <Badge tone={COURSE_TONE[status]}>{COURSE_LABEL[status]}</Badge>;
}
