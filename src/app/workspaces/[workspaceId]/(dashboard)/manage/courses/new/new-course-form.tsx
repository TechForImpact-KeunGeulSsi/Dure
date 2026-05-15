"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { ColorPicker, COURSE_COLOR_PRESETS } from "@/components/courses/color-picker";
import { WeekdayPicker } from "@/components/courses/weekday-picker";
import { planSessions } from "@/lib/courses/recurrence";
import type {
  CourseStatus,
  GroupSummary,
  ISODate,
  ISOTime,
  UUID,
} from "@/lib/api/types";
import {
  createCourseAction,
  getCourseFormOptions,
  type CourseFormOptions,
} from "@/services/courses";

type NewCourseFormProps = {
  workspaceId: string;
  initialOptions: CourseFormOptions;
  accessibleGroups: GroupSummary[];
};

type CourseMode = "one_time" | "recurring";
type EndsMode = "endsOn" | "sessionCount";

type ParticipantSelection = {
  selected: boolean;
  assignmentGroupIds: UUID[];
};

const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_END = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 56);
  return d.toISOString().slice(0, 10);
})();

export function NewCourseForm({
  workspaceId,
  initialOptions,
  accessibleGroups,
}: NewCourseFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [groupIds, setGroupIds] = useState<UUID[]>([]);
  const [instructorMemberId, setInstructorMemberId] = useState<string>("");
  const [status, setStatus] = useState<CourseStatus>("planned");
  const [cardColor, setCardColor] = useState<string>(COURSE_COLOR_PRESETS[0]);

  const [mode, setMode] = useState<CourseMode>("recurring");
  const [startsOn, setStartsOn] = useState<ISODate>(TODAY);
  const [endsMode, setEndsMode] = useState<EndsMode>("endsOn");
  const [endsOn, setEndsOn] = useState<ISODate>(DEFAULT_END);
  const [sessionCount, setSessionCount] = useState<number>(8);
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([1, 3]); // 월·수
  const [startsAt, setStartsAt] = useState<ISOTime>("14:00");
  const [endsAt, setEndsAt] = useState<ISOTime>("16:00");

  const [options, setOptions] = useState<CourseFormOptions>(initialOptions);
  const [participantSelections, setParticipantSelections] = useState<
    Record<UUID, ParticipantSelection>
  >({});
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fetchVersion = useRef(0);

  // 그룹 선택이 바뀔 때마다 참여자 후보 재로드.
  useEffect(() => {
    if (groupIds.length === 0) {
      setOptions((prev) => ({ ...prev, participantCandidates: [] }));
      setParticipantSelections({});
      return;
    }
    setOptionsLoading(true);
    const currentVersion = ++fetchVersion.current;
    (async () => {
      const result = await getCourseFormOptions({ workspaceId, groupIds });
      if (currentVersion !== fetchVersion.current) return; // stale response
      setOptionsLoading(false);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setOptions(result.data);
      // 기존 선택 유지 + 신규 후보는 디폴트로 모든 매칭 그룹 자동 선택.
      setParticipantSelections((prev) => {
        const next: Record<UUID, ParticipantSelection> = {};
        for (const candidate of result.data.participantCandidates) {
          const existing = prev[candidate.id];
          if (existing) {
            const filtered = existing.assignmentGroupIds.filter((gid) =>
              groupIds.includes(gid),
            );
            next[candidate.id] = {
              selected: existing.selected && filtered.length > 0,
              assignmentGroupIds: filtered.length > 0
                ? filtered
                : candidate.defaultAssignmentGroupIds,
            };
          } else {
            next[candidate.id] = {
              selected: true,
              assignmentGroupIds: candidate.defaultAssignmentGroupIds,
            };
          }
        }
        return next;
      });
    })();
  }, [groupIds, workspaceId]);

  const recurrencePayload = useMemo(() => {
    if (mode === "one_time") {
      // 단발성 수업: 시작일의 요일을 사용해 1회차짜리 반복 규칙으로 저장.
      const weekday = new Date(`${startsOn}T00:00:00`).getDay();
      return {
        startsOn,
        endsOn: null as ISODate | null,
        sessionCount: 1 as number | null,
        repeatWeekdays: [weekday],
        startsAt,
        endsAt,
      };
    }
    return {
      startsOn,
      endsOn: endsMode === "endsOn" ? endsOn : null,
      sessionCount: endsMode === "sessionCount" ? sessionCount : null,
      repeatWeekdays,
      startsAt,
      endsAt,
    };
  }, [
    mode,
    startsOn,
    endsMode,
    endsOn,
    sessionCount,
    repeatWeekdays,
    startsAt,
    endsAt,
  ]);

  const sessionPreview = useMemo(
    () => planSessions(recurrencePayload),
    [recurrencePayload],
  );

  const groupOptions = accessibleGroups
    .filter((group) => group.status === "active")
    .map((group) => ({ id: group.id, label: group.name }));

  const selectedGroupIdSet = new Set(groupIds);

  function toggleParticipant(participantId: UUID, defaults: UUID[]) {
    setParticipantSelections((prev) => {
      const existing = prev[participantId];
      if (existing?.selected) {
        return {
          ...prev,
          [participantId]: { selected: false, assignmentGroupIds: [] },
        };
      }
      return {
        ...prev,
        [participantId]: { selected: true, assignmentGroupIds: defaults },
      };
    });
  }

  function setAssignmentGroups(participantId: UUID, ids: UUID[]) {
    setParticipantSelections((prev) => ({
      ...prev,
      [participantId]: {
        selected: ids.length > 0,
        assignmentGroupIds: ids,
      },
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (!name.trim()) {
      toast.error("수업 이름을 입력해 주세요.");
      return;
    }
    if (groupIds.length === 0) {
      toast.error("연결 그룹을 1개 이상 선택해 주세요.");
      return;
    }
    if (mode === "recurring" && repeatWeekdays.length === 0) {
      toast.error("반복 요일을 1개 이상 선택해 주세요.");
      return;
    }
    if (endsAt <= startsAt) {
      toast.error("종료 시간은 시작 시간 이후여야 합니다.");
      return;
    }
    if (sessionPreview.length === 0) {
      toast.error("선택한 조건으로 생성될 회차가 없습니다.");
      return;
    }

    const assignments = options.participantCandidates
      .map((candidate) => {
        const selection = participantSelections[candidate.id];
        if (!selection?.selected) return null;
        // 자기 수업에 연결된 그룹 중에서만 assignment가 가능.
        const filtered = selection.assignmentGroupIds.filter((gid) =>
          selectedGroupIdSet.has(gid),
        );
        if (filtered.length === 0) return null;
        return {
          participantId: candidate.id,
          assignmentGroupIds: filtered,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    startTransition(async () => {
      const result = await createCourseAction(workspaceId, {
        name: name.trim(),
        status,
        groupIds,
        instructorMemberId: instructorMemberId || null,
        cardColor,
        recurrence: recurrencePayload,
        participantAssignments: assignments,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("수업을 만들었어요.");
      router.replace(`/workspaces/${workspaceId}/manage/courses`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <header>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
          새 수업 만들기
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          기본 정보, 반복 회차, 참여자 배정을 한 번에 입력해요.
        </p>
      </header>

      <Section title="기본 정보">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="course-name">수업 이름</Label>
            <Input
              id="course-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="예: 코딩 기초"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>연결 그룹</Label>
            <MultiSelect
              options={groupOptions}
              selectedIds={groupIds}
              onChange={(ids) => setGroupIds(ids as UUID[])}
              placeholder="그룹 선택"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-instructor">담당 강사</Label>
            <Select
              id="course-instructor"
              value={instructorMemberId}
              onChange={(event) => setInstructorMemberId(event.target.value)}
            >
              <option value="">미지정</option>
              {options.instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.displayName ?? instructor.email}
                  {instructor.status === "invited" ? " (초대 대기)" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-status">운영 상태</Label>
            <Select
              id="course-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as CourseStatus)}
            >
              <option value="planned">진행 전</option>
              <option value="in_progress">진행 중</option>
              <option value="completed">진행 완료</option>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>카드 색상</Label>
            <ColorPicker value={cardColor} onChange={setCardColor} />
          </div>
        </div>
      </Section>

      <Section title="회차 설정">
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <ModePill
            active={mode === "one_time"}
            onClick={() => setMode("one_time")}
          >
            일회성 수업
          </ModePill>
          <ModePill
            active={mode === "recurring"}
            onClick={() => setMode("recurring")}
          >
            반복 회차 수업
          </ModePill>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="course-starts-on">
              {mode === "one_time" ? "수업 날짜" : "시작일"}
            </Label>
            <Input
              id="course-starts-on"
              type="date"
              value={startsOn}
              onChange={(event) => setStartsOn(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-starts-at">시작 시간</Label>
            <Input
              id="course-starts-at"
              type="time"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2 md:col-start-1">
            <Label htmlFor="course-ends-at">종료 시간</Label>
            <Input
              id="course-ends-at"
              type="time"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              required
            />
          </div>

          {mode === "recurring" && (
            <>
              <div className="space-y-2 md:col-span-2">
                <Label>반복 요일</Label>
                <WeekdayPicker
                  value={repeatWeekdays}
                  onChange={setRepeatWeekdays}
                />
              </div>
              <div className="space-y-2">
                <Label>종료 조건</Label>
                <div className="grid grid-cols-2 gap-2">
                  <ModePill
                    active={endsMode === "endsOn"}
                    onClick={() => setEndsMode("endsOn")}
                  >
                    특정 날짜까지
                  </ModePill>
                  <ModePill
                    active={endsMode === "sessionCount"}
                    onClick={() => setEndsMode("sessionCount")}
                  >
                    총 회차 수
                  </ModePill>
                </div>
              </div>
              {endsMode === "endsOn" ? (
                <div className="space-y-2">
                  <Label htmlFor="course-ends-on">종료일</Label>
                  <Input
                    id="course-ends-on"
                    type="date"
                    value={endsOn}
                    onChange={(event) => setEndsOn(event.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="course-session-count">총 회차 수</Label>
                  <Input
                    id="course-session-count"
                    type="number"
                    min={1}
                    max={500}
                    value={sessionCount}
                    onChange={(event) =>
                      setSessionCount(Number(event.target.value) || 1)
                    }
                    required
                  />
                </div>
              )}
            </>
          )}
        </div>

        <SessionPreview mode={mode} sessions={sessionPreview} />
      </Section>

      <Section title="참여자 배정">
        {groupIds.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            연결 그룹을 먼저 선택하면 참여자 후보가 표시됩니다.
          </p>
        ) : optionsLoading ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            후보를 불러오는 중…
          </p>
        ) : options.participantCandidates.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            선택한 그룹에 활성 참여자가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
            {options.participantCandidates.map((candidate) => {
              const selection = participantSelections[candidate.id];
              const groupChoices = candidate.groups
                .filter((group) => selectedGroupIdSet.has(group.id))
                .map((group) => ({ id: group.id, label: group.name }));
              return (
                <li
                  key={candidate.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selection?.selected ?? false}
                      onChange={() =>
                        toggleParticipant(
                          candidate.id,
                          candidate.defaultAssignmentGroupIds,
                        )
                      }
                      className="size-4 accent-[var(--color-primary)]"
                    />
                    <span className="font-medium text-[var(--color-foreground)]">
                      {candidate.name}
                    </span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {candidate.groups.map((group) => group.name).join(", ")}
                    </span>
                  </label>
                  {selection?.selected && (
                    <div className="sm:max-w-xs sm:flex-1">
                      <MultiSelect
                        options={groupChoices}
                        selectedIds={selection.assignmentGroupIds}
                        onChange={(ids) =>
                          setAssignmentGroups(candidate.id, ids as UUID[])
                        }
                        placeholder="수업 내 참여 그룹"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link
          href={`/workspaces/${workspaceId}/manage/courses`}
          className="text-sm font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          취소
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "만드는 중…" : "수업 만들기"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
      <h2 className="text-base font-semibold text-[var(--color-foreground)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ModePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors " +
        (active
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
          : "border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:bg-[var(--color-muted)]")
      }
    >
      {children}
    </button>
  );
}

function SessionPreview({
  mode,
  sessions,
}: {
  mode: CourseMode;
  sessions: { sessionNo: number; date: ISODate; startsAt: ISOTime; endsAt: ISOTime }[];
}) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {mode === "one_time"
          ? "수업 날짜와 시간을 다시 확인해 주세요."
          : "선택한 조건으로 만들 수 있는 회차가 없습니다. 요일과 기간을 다시 확인해 주세요."}
      </div>
    );
  }
  const visible = sessions.slice(0, 5);
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-4 py-3 text-sm">
      <p className="font-medium text-[var(--color-foreground)]">
        {mode === "one_time"
          ? "1회 수업이 생성됩니다"
          : `총 ${sessions.length}회 회차가 생성됩니다`}
      </p>
      <ul className="mt-2 grid gap-1 text-xs text-[var(--color-muted-foreground)]">
        {visible.map((session) => (
          <li key={session.sessionNo}>
            {mode === "one_time"
              ? `${session.date} · ${session.startsAt.slice(0, 5)}–${session.endsAt.slice(0, 5)}`
              : `${session.sessionNo}회차 · ${session.date} · ${session.startsAt.slice(0, 5)}–${session.endsAt.slice(0, 5)}`}
          </li>
        ))}
        {sessions.length > visible.length && (
          <li>외 {sessions.length - visible.length}회</li>
        )}
      </ul>
    </div>
  );
}
