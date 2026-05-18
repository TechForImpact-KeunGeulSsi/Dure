"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { ColorPicker } from "@/components/courses/color-picker";
import type {
  CourseStatus,
  InstructorSummary,
  UUID,
} from "@/lib/api/types";
import { updateCourseAction, type CourseEditData } from "@/services/courses";

type Props = {
  workspaceId: string;
  courseId: string;
  initial: CourseEditData["course"];
  options: CourseEditData["options"];
};

const STATUS_OPTIONS: Array<{ value: CourseStatus; label: string }> = [
  { value: "planned", label: "진행 전" },
  { value: "in_progress", label: "진행 중" },
  { value: "completed", label: "진행 완료" },
];

function setsEqual<T>(a: Iterable<T>, b: Iterable<T>): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

export function EditCourseForm({
  workspaceId,
  courseId,
  initial,
  options,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [status, setStatus] = useState<CourseStatus>(initial.status);
  const [groupIds, setGroupIds] = useState<UUID[]>(initial.groupIds);
  const [instructorMemberId, setInstructorMemberId] = useState<string>(
    initial.instructorMemberId ?? "",
  );
  const [cardColor, setCardColor] = useState<string>(
    initial.cardColor ?? "#2563eb",
  );
  const [bannerUrl, setBannerUrl] = useState<string>(initial.bannerUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const groupOptions = useMemo(
    () => options.groups.map((g) => ({ id: g.id, label: g.name })),
    [options.groups],
  );

  const removedGroupNames = useMemo(() => {
    const nameById = new Map(options.groups.map((g) => [g.id, g.name]));
    return initial.groupIds
      .filter((id) => !groupIds.includes(id))
      .map((id) => nameById.get(id) ?? id);
  }, [initial.groupIds, groupIds, options.groups]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFieldErrors({});
    setGlobalError(null);

    if (groupIds.length === 0) {
      setFieldErrors({ groupIds: ["연결 그룹은 1개 이상이어야 합니다."] });
      return;
    }
    if (name.trim().length === 0) {
      setFieldErrors({ name: ["수업 이름을 입력해 주세요."] });
      return;
    }

    // 변경된 필드만 추려서 전송
    const payload: Parameters<typeof updateCourseAction>[2] = {};
    if (name.trim() !== initial.name) payload.name = name.trim();
    if (status !== initial.status) payload.status = status;
    if (!setsEqual(groupIds, initial.groupIds)) payload.groupIds = groupIds;
    const nextInstructor = instructorMemberId || null;
    if (nextInstructor !== initial.instructorMemberId)
      payload.instructorMemberId = nextInstructor;
    if (cardColor !== (initial.cardColor ?? "#2563eb"))
      payload.cardColor = cardColor || null;
    const trimmedBanner = bannerUrl.trim();
    const nextBanner = trimmedBanner.length > 0 ? trimmedBanner : null;
    if (nextBanner !== initial.bannerUrl) payload.bannerUrl = nextBanner;

    if (Object.keys(payload).length === 0) {
      toast.info("변경된 내용이 없습니다.");
      return;
    }

    setSubmitting(true);
    const result = await updateCourseAction(workspaceId, courseId, payload);
    setSubmitting(false);

    if (!result.ok) {
      if (result.error.fieldErrors) setFieldErrors(result.error.fieldErrors);
      setGlobalError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success("수업 정보를 저장했습니다.");
    router.push(`/workspaces/${workspaceId}/manage/courses`);
    router.refresh();
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
          수업 정보 수정
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          이름·연결 그룹·담당 강사·운영 상태·시각 정보를 변경할 수 있습니다.
          회차나 참여자 배정은 별도 페이지에서 관리합니다.
        </p>
      </header>

      <Section title="기본 정보">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="course-name">수업 이름</Label>
            <Input
              id="course-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
            <FieldError errors={fieldErrors.name} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="course-status">운영 상태</Label>
            <Select
              id="course-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as CourseStatus)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="course-instructor">담당 강사</Label>
            <Select
              id="course-instructor"
              value={instructorMemberId}
              onChange={(e) => setInstructorMemberId(e.target.value)}
            >
              <option value="">지정 안 함</option>
              {options.instructors.map((ins) => (
                <option key={ins.id} value={ins.id}>
                  {instructorLabel(ins)}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>연결 그룹</Label>
            <MultiSelect
              options={groupOptions}
              selectedIds={groupIds}
              onChange={setGroupIds}
              placeholder="그룹을 선택하세요"
            />
            <FieldError errors={fieldErrors.groupIds} />
            {removedGroupNames.length > 0 && (
              <p className="text-xs text-amber-700">
                연결 해제 예정: {removedGroupNames.join(", ")} — 연결만 해제되며, 기존 참여자 배정은 보존되어 다시 연결 시 복구됩니다.
              </p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>카드 색상</Label>
            <ColorPicker value={cardColor} onChange={setCardColor} />
            <FieldError errors={fieldErrors.cardColor} />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="course-banner">배너 이미지 URL (선택)</Label>
            <Input
              id="course-banner"
              type="url"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://example.com/banner.png"
            />
            <FieldError errors={fieldErrors.bannerUrl} />
          </div>
        </div>
      </Section>

      {globalError && (
        <p className="text-sm text-rose-600">{globalError}</p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Link
          href={`/workspaces/${workspaceId}/manage/courses`}
          className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-4 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
        >
          취소
        </Link>
        <Button type="submit" disabled={submitting}>
          {submitting ? "저장 중…" : "저장"}
        </Button>
      </div>
    </form>
  );
}

function instructorLabel(ins: InstructorSummary): string {
  const name = ins.displayName?.trim();
  const suffix = ins.status === "invited" ? " (초대 대기)" : "";
  return `${name && name.length > 0 ? `${name} · ${ins.email}` : ins.email}${suffix}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h2 className="mb-4 text-sm font-semibold text-[var(--color-foreground)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null;
  return <p className="text-xs text-rose-600">{errors[0]}</p>;
}
