import { CalendarDays, FileText, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { PublicCourseDetail, PublicCourseMaterial } from "@/services/public-catalog";
import { COURSE_STATUS_LABEL, SESSION_PROGRESS_LABEL, SESSION_TYPE_LABEL } from "@/types/course";

import { PublicMaterialDownloadButton } from "./public-material-download-button";

type PublicCourseDetailViewProps = {
  course: PublicCourseDetail;
  hiddenNotice?: boolean;
  isLoggedIn?: boolean;
};

function formatPeriod(startsOn: string | null, endsOn: string | null) {
  if (!startsOn && !endsOn) return "기간 미정";
  const start = startsOn?.replaceAll("-", ".") ?? "시작일 미정";
  const end = endsOn?.replaceAll("-", ".") ?? "종료일 미정";
  return `${start} - ${end}`;
}

function formatTimeRange(startsAt: string, endsAt: string) {
  return `${startsAt.slice(0, 5)} - ${endsAt.slice(0, 5)}`;
}

export function PublicCourseDetailView({
  course,
  hiddenNotice = false,
  isLoggedIn = false,
}: PublicCourseDetailViewProps) {
  const accent = course.cardColor ?? "#2563EB";

  return (
    <article className="space-y-8">
      {hiddenNotice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          현재 숨김 상태라 외부 공개 페이지에는 표시되지 않습니다.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {course.bannerUrl ? (
          <img src={course.bannerUrl} alt="" className="h-56 w-full object-cover" />
        ) : (
          <div className="h-3" style={{ backgroundColor: accent }} />
        )}
        <div className="space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-blue-700">{course.workspace.name}</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-950">{course.name}</h1>
            </div>
            <Badge tone={course.status === "in_progress" ? "primary" : "neutral"}>
              {COURSE_STATUS_LABEL[course.status]}
            </Badge>
          </div>

          <dl
            className={`grid grid-cols-1 gap-3 ${isLoggedIn ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}
          >
            {isLoggedIn ? (
              <>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    기간
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    {formatPeriod(course.startsOn, course.endsOn)}
                  </dd>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <ListChecks className="h-3.5 w-3.5" />
                    회차
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    {course.sessionCount}회
                  </dd>
                </div>
              </>
            ) : null}
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <FileText className="h-3.5 w-3.5" />
                자료
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {course.materialCount}개
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-1.5">
            {course.groupNames.map((name) => (
              <span
                key={name}
                className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-950">회차 일정</h2>
        {isLoggedIn ? (
          course.sessions.length > 0 ? (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {course.sessions.map((session) => (
                <div
                  key={`${session.sessionNo}-${session.date}-${session.startsAt}`}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[80px_1fr_auto]"
                >
                  <span className="text-sm font-semibold text-gray-900">
                    {session.sessionNo}회차
                  </span>
                  <span className="text-sm text-gray-600">
                    {session.date.replaceAll("-", ".")} ·{" "}
                    {formatTimeRange(session.startsAt, session.endsAt)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {SESSION_TYPE_LABEL[session.type]} ·{" "}
                    {SESSION_PROGRESS_LABEL[session.progressStatus]}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
              등록된 회차 일정이 없습니다.
            </p>
          )
        ) : (
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
            일정 상세 정보는 로그인 후 확인할 수 있습니다.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-950">공개 자료</h2>
        {course.materials.length > 0 ? (
          <div className="grid gap-3">
            {course.materials.map((material) => (
              <PublicMaterialRow key={material.id} material={material} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
            공개된 자료가 아직 없습니다.
          </p>
        )}
      </section>
    </article>
  );
}

function PublicMaterialRow({ material }: { material: PublicCourseMaterial }) {
  const isDemoMaterial = material.id.startsWith("demo-material-");

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-gray-900">{material.title}</h3>
        {material.description ? (
          <p className="mt-1 text-sm text-gray-600">{material.description}</p>
        ) : null}
        {material.originalFilename ? (
          <p className="mt-1 truncate text-xs text-gray-400">
            {material.originalFilename}
          </p>
        ) : null}
      </div>
      {isDemoMaterial ? (
        <span className="inline-flex shrink-0 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500">
          목업 자료
        </span>
      ) : (
        <PublicMaterialDownloadButton materialId={material.id} />
      )}
    </div>
  );
}
