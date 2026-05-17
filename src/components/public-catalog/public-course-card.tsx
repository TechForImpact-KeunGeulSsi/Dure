import Link from "next/link";
import { BookOpen, CalendarDays, FileText, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { PublicCourseSummary } from "@/services/public-catalog";
import { COURSE_STATUS_LABEL } from "@/types/course";

type PublicCourseCardProps = {
  course: PublicCourseSummary;
};

function formatPeriod(startsOn: string | null, endsOn: string | null) {
  if (!startsOn && !endsOn) return "기간 미정";
  const start = startsOn?.replaceAll("-", ".") ?? "시작일 미정";
  const end = endsOn?.replaceAll("-", ".") ?? "종료일 미정";
  return `${start} - ${end}`;
}

export function PublicCourseCard({ course }: PublicCourseCardProps) {
  const accent = course.cardColor ?? "#2563EB";

  return (
    <Link
      href={`/public/courses/${course.id}`}
      className="group grid min-h-[240px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      {course.bannerUrl ? (
        <div className="relative h-28 overflow-hidden">
          <img
            src={course.bannerUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        </div>
      ) : (
        <div className="h-2" style={{ backgroundColor: accent }} />
      )}

      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-semibold text-gray-950">
              {course.name}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatPeriod(course.startsOn, course.endsOn)}
            </p>
          </div>
          <Badge tone={course.status === "in_progress" ? "primary" : "neutral"}>
            {COURSE_STATUS_LABEL[course.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {course.groupNames.length > 0 ? (
            course.groupNames.map((name) => (
              <span
                key={name}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {name}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-400">연결된 그룹 없음</span>
          )}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-blue-600" />
            {course.sessionCount}회차
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            {course.materialCount}개 자료
          </span>
          <span className="col-span-2 inline-flex items-center gap-1.5 text-gray-500">
            <Users className="h-3.5 w-3.5" />
            {course.workspace.name}
          </span>
        </div>
      </div>
    </Link>
  );
}
