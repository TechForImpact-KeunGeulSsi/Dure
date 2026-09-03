'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';

import { SessionList } from '@/components/courses/session-list';
import type { CourseHomePageData } from '@/types/course';
import { COURSE_STATUS_LABEL } from '@/types/course';

type CourseHomeClientProps = {
  workspaceId: string;
  data: CourseHomePageData;
};

function formatPeriod(startsOn: string | null, endsOn: string | null) {
  if (!startsOn && !endsOn) return '-';
  const start = startsOn?.replaceAll('-', '.') ?? '-';
  const end = endsOn?.replaceAll('-', '.') ?? '-';
  return `${start} ~ ${end}`;
}

function darkenHex(hex: string, amount = 0.15) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(normalized.slice(offset, offset + 2), 16);
    return Math.max(0, Math.round(value * (1 - amount)));
  });
  return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function CourseHomeClient({
  workspaceId,
  data,
}: CourseHomeClientProps) {
  const { course, sessions, sessionCount } = data;
  const accent = course.cardColor ?? '#2563EB';
  const gradientEnd = darkenHex(accent, 0.2);
  const groupLabel = course.groups.map((group) => group.name).join(', ') || '-';
  const instructorLabel = course.instructor?.displayName ?? course.instructor?.email ?? '미배정';
  const courseHomeHref = `/workspaces/${workspaceId}/courses/${course.id}/home`;
  const editHref = `/workspaces/${workspaceId}/manage/courses/${course.id}/edit?returnTo=${encodeURIComponent(courseHomeHref)}`;

  const infoItems = [
    { label: '수업명', value: course.name },
    { label: '그룹', value: groupLabel },
    { label: '강사', value: instructorLabel },
    { label: '기간', value: formatPeriod(course.startsOn, course.endsOn) },
    { label: '진행 상태', value: COURSE_STATUS_LABEL[course.status] },
    { label: '회차 수', value: `${sessionCount}회` },
  ];

  return (
    <section className="space-y-6">
      <section
        className="relative overflow-hidden rounded-xl p-8 shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${gradientEnd} 100%)`,
        }}
      >
        <span className="pointer-events-none absolute -right-8 -top-8 block h-40 w-40 rounded-3xl bg-white/10" />
        <span className="pointer-events-none absolute bottom-0 right-16 block h-28 w-28 rotate-12 rounded-2xl bg-black/10" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white">{course.name}</h2>
            <p className="mt-1 text-sm text-blue-100">{groupLabel}</p>
          </div>
          {course.canUpdateVisuals ? (
            <Link
              href={editHref}
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-white/30 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/20"
            >
              <Pencil className="h-3.5 w-3.5" />
              맞춤설정
            </Link>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">수업 정보</h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {infoItems.map((item) => (
            <div key={item.label} className="rounded-lg bg-gray-50 px-4 py-3">
              <dt className="text-xs font-medium text-gray-500">{item.label}</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <SessionList workspaceId={workspaceId} initialSessions={sessions} />
    </section>
  );
}
