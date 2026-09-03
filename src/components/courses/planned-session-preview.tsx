"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ISODate, ISOTime } from "@/lib/api/types";
import type { CreateCourseSessionPlanInput } from "@/lib/validators/course";

export type PlannedSession = {
  sessionNo: number;
  date: ISODate;
  startsAt: ISOTime;
  endsAt: ISOTime;
};

export type SessionPlanDraft = Pick<
  CreateCourseSessionPlanInput,
  "progressStatus" | "rollupStatus" | "cancellationReason"
>;

type PlannedSessionPreviewProps = {
  mode: "one_time" | "recurring";
  sessions: PlannedSession[];
  plansBySessionNo: Record<number, SessionPlanDraft>;
  onChangeReason: (sessionNo: number, reason: string) => void;
  onToggleCancel: (sessionNo: number) => void;
  onRestore: (sessionNo: number) => void;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function formatWeekday(date: ISODate) {
  return WEEKDAY_LABELS[new Date(`${date}T00:00:00`).getDay()];
}

function formatDate(date: ISODate) {
  return date.replaceAll("-", ".");
}

function formatTimeRange(startsAt: ISOTime, endsAt: ISOTime) {
  return `${startsAt.slice(0, 5)}–${endsAt.slice(0, 5)}`;
}

export function defaultSessionPlan(): SessionPlanDraft {
  return {
    progressStatus: "scheduled",
    rollupStatus: "included",
    cancellationReason: null,
  };
}

export function PlannedSessionPreview({
  mode,
  sessions,
  plansBySessionNo,
  onChangeReason,
  onToggleCancel,
  onRestore,
}: PlannedSessionPreviewProps) {
  const validCount = useMemo(
    () =>
      sessions.filter(
        (s) => (plansBySessionNo[s.sessionNo]?.progressStatus ?? "scheduled") === "scheduled",
      ).length,
    [sessions, plansBySessionNo],
  );

  if (sessions.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {mode === "one_time"
          ? "수업 날짜와 시간을 다시 확인해 주세요."
          : "선택한 조건으로 만들 수 있는 회차가 없습니다. 요일과 기간을 다시 확인해 주세요."}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
          생성 예정인 수업 회차 목록
        </h3>
        <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
          공휴일·행사 등으로 진행하지 않을 날짜는 휴강 처리하세요. 휴강 회차도 기록되며 출석
          집계에서 제외됩니다.
        </p>
      </div>

      <ul className="max-h-80 divide-y divide-[var(--color-border)] overflow-y-auto">
        {sessions.map((session) => {
          const plan = plansBySessionNo[session.sessionNo] ?? defaultSessionPlan();
          const cancelled = plan.progressStatus === "cancelled";

          return (
            <li
              key={session.sessionNo}
              className={cn(
                "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between",
                cancelled && "bg-muted/50",
              )}
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {mode === "recurring" && (
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        cancelled
                          ? "text-muted-foreground line-through"
                          : "text-[var(--color-foreground)]",
                      )}
                    >
                      {session.sessionNo}회차
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      cancelled
                        ? "text-muted-foreground line-through"
                        : "text-[var(--color-foreground)]",
                    )}
                  >
                    {formatDate(session.date)} ({formatWeekday(session.date)})
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      cancelled ? "text-muted-foreground line-through" : "text-muted-foreground",
                    )}
                  >
                    {formatTimeRange(session.startsAt, session.endsAt)}
                  </span>
                  {cancelled && (
                    <Badge tone="neutral" className="bg-rose-100 text-rose-800">
                      휴강
                    </Badge>
                  )}
                </div>
                {cancelled && (
                  <Input
                    value={plan.cancellationReason ?? ""}
                    onChange={(event) => onChangeReason(session.sessionNo, event.target.value)}
                    placeholder="휴강 사유 (예: 공휴일, 센터 행사)"
                    maxLength={500}
                    className="h-8 text-xs"
                  />
                )}
              </div>

              <div className="shrink-0">
                {cancelled ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onRestore(session.sessionNo)}
                  >
                    복구
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleCancel(session.sessionNo)}
                  >
                    휴강 처리
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-[var(--color-border)] bg-[var(--color-muted)]/30 px-4 py-3 text-sm">
        <p className="font-medium text-[var(--color-foreground)]">
          유효 회차 수: {validCount}회
          <span className="ml-2 font-normal text-[var(--color-muted-foreground)]">
            (전체 {sessions.length}회 · 휴강 {sessions.length - validCount}회)
          </span>
        </p>
      </div>
    </div>
  );
}
