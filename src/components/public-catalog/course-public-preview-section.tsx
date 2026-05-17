"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { PublicCourseDetailView } from "@/components/public-catalog/public-course-detail-view";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { PublicCourseDetail } from "@/services/public-catalog";
import { updateCoursePublicVisibility } from "@/services/public-catalog";

type CoursePublicPreviewSectionProps = {
  workspaceId: string;
  course: PublicCourseDetail | null;
  errorMessage?: string | null;
};

export function CoursePublicPreviewSection({
  workspaceId,
  course,
  errorMessage,
}: CoursePublicPreviewSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [localCourse, setLocalCourse] = useState(course);
  const [message, setMessage] = useState<string | null>(errorMessage ?? null);

  if (!localCourse) {
    return (
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">공개 페이지 미리보기</h3>
        <p className="mt-3 text-sm text-rose-600">
          {message ?? "공개 미리보기를 불러오지 못했습니다."}
        </p>
      </section>
    );
  }

  const isPublic = localCourse.publicVisibility === "public";

  function handleToggle(checked: boolean) {
    if (!localCourse) return;
    setMessage(null);
    const nextVisibility = checked ? "public" : "hidden";
    startTransition(async () => {
      const result = await updateCoursePublicVisibility({
        workspaceId,
        courseId: localCourse.id,
        publicVisibility: nextVisibility,
      });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setLocalCourse({
        ...localCourse,
        publicVisibility: result.data.publicVisibility,
      });
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">공개 페이지 미리보기</h3>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone={isPublic ? "success" : "warning"}>
              {isPublic ? "공개" : "숨김"}
            </Badge>
            {isPublic ? (
              <Link
                href={`/public/courses/${localCourse.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                공개 페이지 열기
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          공개 카탈로그 표시
          <Switch
            checked={isPublic}
            disabled={isPending}
            onCheckedChange={handleToggle}
            aria-label="공개 카탈로그 표시"
          />
        </label>
      </div>

      {message ? <p className="text-sm text-rose-600">{message}</p> : null}

      <PublicCourseDetailView course={localCourse} hiddenNotice={!isPublic} />
    </section>
  );
}
