'use client';

import { CalendarDays, ClipboardCheck, FileText } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { InstructorCourseHomeOutput } from '@/services/instructor-course';

type Props = {
  workspaceId: string;
  courseId: string;
  data: InstructorCourseHomeOutput;
};

export function InstructorHomeClient({ workspaceId, courseId, data }: Props) {
  const accent = data.course.cardColor ?? '#2563EB';
  const todayBase = `/workspaces/${workspaceId}/teach/courses/${courseId}`;

  return (
    <section className="space-y-6">
      <Banner accent={accent} name={data.course.name} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="오늘 회차"
          value={`${data.todaySessions.length}회`}
          tone="blue"
          icon={CalendarDays}
        />
        <StatCard
          label="전체 자료"
          value={`${data.materialCount}건`}
          tone="emerald"
          icon={FileText}
        />
        <StatCard
          label="확인 미정 자료"
          value={`${data.pendingMaterialCount}건`}
          tone="amber"
          icon={ClipboardCheck}
        />
      </div>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900">오늘 일정</h3>
        {data.todaySessions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-gray-500">오늘 진행할 회차가 없습니다.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.todaySessions.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {s.sessionNo}회차
                      </span>
                      <span className="text-xs text-gray-500">
                        {s.startsAt.slice(0, 5)} ~ {s.endsAt.slice(0, 5)}
                      </span>
                      {s.type !== 'regular' && <Badge tone="neutral">보강</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      출석 {s.attendanceSavedCount}/{s.attendanceTargetCount} ·{' '}
                      {s.classMemo ? '메모 작성됨' : '메모 없음'}
                    </p>
                  </div>
                  <Link
                    href={`${todayBase}/attendance`}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    출석 입력 →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-gray-900">예정 회차</h3>
        {data.upcomingSessions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-gray-500">예정된 회차가 없습니다.</p>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-gray-100">
              {data.upcomingSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {s.sessionNo}회차 · {formatDate(s.date)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {s.startsAt.slice(0, 5)} ~ {s.endsAt.slice(0, 5)}
                    </p>
                  </div>
                  {s.type !== 'regular' && <Badge tone="neutral">보강</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </section>
  );
}

function Banner({ accent, name }: { accent: string; name: string }) {
  return (
    <section
      className="rounded-xl p-8 shadow-sm"
      style={{ background: `linear-gradient(135deg, ${accent} 0%, #1d4ed8 100%)` }}
    >
      <h2 className="text-2xl font-bold text-white">{name}</h2>
      <p className="mt-1 text-sm text-blue-100">
        담당 수업의 오늘 일정과 자료 현황을 한눈에 확인하세요.
      </p>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'emerald' | 'amber';
  icon: typeof CalendarDays;
}) {
  const colors = {
    blue: { value: 'text-blue-600', icon: 'text-blue-500' },
    emerald: { value: 'text-emerald-600', icon: 'text-emerald-500' },
    amber: { value: 'text-amber-600', icon: 'text-amber-500' },
  }[tone];

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{label}</CardTitle>
            <p className={cn('mt-1 text-2xl font-bold', colors.value)}>{value}</p>
          </div>
          <Icon className={cn('h-5 w-5', colors.icon)} />
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(date: string): string {
  return date.replaceAll('-', '.');
}