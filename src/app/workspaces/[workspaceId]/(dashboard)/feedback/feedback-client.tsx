"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  courseFeedbackCategoryLabel,
  courseFeedbackStatusLabel,
} from "@/lib/api/labels";
import type {
  CourseFeedbackCategory,
  CourseFeedbackListItem,
  CourseFeedbackStatus,
  UUID,
} from "@/lib/api/types";
import { formatFeedbackDateTime } from "@/lib/utils/format-feedback-date-time";
import { cn } from "@/lib/utils/cn";
import {
  deleteCourseFeedback,
  updateCourseFeedbackStatus,
  type GetCourseFeedbacksOutput,
} from "@/services/course-feedbacks";

type Props = {
  workspaceId: UUID;
  initial: GetCourseFeedbacksOutput;
};

type CategoryFilter = "all" | CourseFeedbackCategory;
type StatusFilter = "all" | CourseFeedbackStatus;

const CATEGORY_FILTERS: CategoryFilter[] = [
  "all",
  "suggestion",
  "praise",
  "other",
];

const STATUS_FILTERS: StatusFilter[] = ["all", "new", "reviewed"];

const STATUS_TONE: Record<CourseFeedbackStatus, "warning" | "success"> = {
  new: "warning",
  reviewed: "success",
};

export function FeedbackClient({ workspaceId, initial }: Props) {
  const router = useRouter();
  const [courseId, setCourseId] = useState<"all" | UUID>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [pendingId, setPendingId] = useState<UUID | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return initial.feedbacks.filter((item) => {
      if (courseId !== "all" && item.courseId !== courseId) return false;
      if (category !== "all" && item.category !== category) return false;
      if (status !== "all" && item.status !== status) return false;
      return true;
    });
  }, [category, courseId, initial.feedbacks, status]);

  function handleStatus(item: CourseFeedbackListItem) {
    const nextStatus: CourseFeedbackStatus =
      item.status === "new" ? "reviewed" : "new";
    setPendingId(item.id);
    startTransition(async () => {
      const result = await updateCourseFeedbackStatus(workspaceId, item.id, {
        status: nextStatus,
      });
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(item: CourseFeedbackListItem) {
    if (!confirm("이 의견을 삭제할까요?")) return;
    setPendingId(item.id);
    startTransition(async () => {
      const result = await deleteCourseFeedback(workspaceId, item.id);
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="미확인" value={initial.counts.new} tone="warning" />
        <Stat label="확인됨" value={initial.counts.reviewed} tone="success" />
      </div>

      <div className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-white p-4 md:grid-cols-3">
        <label className="space-y-1 text-sm font-medium text-[var(--color-foreground)]">
          <span>수업</span>
          <Select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value as "all" | UUID)}
          >
            <option value="all">전체 수업</option>
            {initial.courseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-sm font-medium text-[var(--color-foreground)]">
          <span>구분</span>
          <Select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as CategoryFilter)
            }
          >
            {CATEGORY_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "전체 구분" : courseFeedbackCategoryLabel(value)}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-sm font-medium text-[var(--color-foreground)]">
          <span>상태</span>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "전체 상태" : courseFeedbackStatusLabel(value)}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <p className="text-xs text-[var(--color-muted-foreground)]">
        최근 100건 기준으로 표시합니다.
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-white px-4 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
          아직 접수된 의견이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-[var(--color-border)] bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-foreground)]">
                    {item.courseName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    {formatFeedbackDateTime(item.createdAt, initial.timezone)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="primary">
                    {courseFeedbackCategoryLabel(item.category)}
                  </Badge>
                  <Badge tone={STATUS_TONE[item.status]}>
                    {courseFeedbackStatusLabel(item.status)}
                  </Badge>
                </div>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--color-foreground)]">
                {item.message}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                <div className="text-sm text-[var(--color-muted-foreground)]">
                  <span className="font-medium text-[var(--color-foreground)]">
                    {item.authorName ?? "익명"}
                  </span>
                  {item.authorPhone ? (
                    <span className="ml-2">{item.authorPhone}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending && pendingId === item.id}
                    onClick={() => handleStatus(item)}
                  >
                    {item.status === "new"
                      ? "확인 처리"
                      : "미확인으로 되돌리기"}
                  </Button>
                  {item.canDelete ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="삭제"
                      disabled={pending && pendingId === item.id}
                      onClick={() => handleDelete(item)}
                      className={cn("text-rose-600 hover:bg-rose-50")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-emerald-700 bg-emerald-50 border-emerald-200";
  return (
    <div className={cn("rounded-lg border px-4 py-3", toneClass)}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}건</p>
    </div>
  );
}
