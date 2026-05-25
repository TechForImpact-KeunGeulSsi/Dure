'use client';

import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  excludeCourseParticipant,
  reincludeCourseParticipant,
  type GetCourseParticipantsStatusResult,
} from '@/services/course-participants';
import type {
  AttendanceStatus,
  CourseParticipantStatusItem,
  ParticipantRowStatus,
} from '@/types/course';
import {
  COURSE_PARTICIPANT_STATUS_LABEL,
  PARTICIPANT_ROW_STATUS_LABEL,
} from '@/types/course';

type Props = {
  workspaceId: string;
  courseId: string;
  data: GetCourseParticipantsStatusResult;
};

type AttendanceFilter = 'all' | AttendanceStatus;
type ViewMode = 'cumulative' | 'by-session';

const ATTENDANCE_FILTERS: {
  value: AttendanceFilter;
  label: string;
  activeClassName?: string;
}[] = [
  { value: 'all', label: '전체', activeClassName: 'text-blue-600' },
  { value: 'present', label: '출석', activeClassName: 'text-green-600' },
  { value: 'partial', label: '지각', activeClassName: 'text-amber-600' },
  { value: 'absent', label: '결석', activeClassName: 'text-red-600' },
];

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '출석',
  partial: '지각',
  absent: '결석',
};

const STATUS_TONE: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  absent: 'bg-rose-50 text-rose-700 border-rose-200',
};

function getRowStatus(item: CourseParticipantStatusItem): ParticipantRowStatus {
  if (item.partialCount > 0 || item.absentCount > 0) return 'attention';
  return 'normal';
}

function getInitials(name: string) {
  return name.slice(0, 1);
}

export function ParticipantsStatusClient({ workspaceId, courseId, data }: Props) {
  const router = useRouter();
  const accent = data.course.cardColor ?? '#2563EB';
  const [search, setSearch] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('all');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cumulative');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    data.sessionsView.sessions[0]?.id ?? null,
  );

  // 회차별 보기용: (sessionId, participantId) → record 빠른 조회 맵
  const recordIndex = useMemo(() => {
    const map = new Map<string, { status: AttendanceStatus; note: string | null }>();
    for (const r of data.sessionsView.records) {
      map.set(`${r.sessionId}:${r.participantId}`, {
        status: r.status,
        note: r.note,
      });
    }
    return map;
  }, [data.sessionsView.records]);

  const filteredParticipants = useMemo(() => {
    return data.participants.filter((item) => {
      const matchesSearch =
        search.trim() === '' ||
        item.participant.name.toLowerCase().includes(search.trim().toLowerCase());
      if (viewMode === 'cumulative') {
        const matchesAttendance =
          attendanceFilter === 'all' ||
          (attendanceFilter === 'present' && item.presentCount > 0) ||
          (attendanceFilter === 'partial' && item.partialCount > 0) ||
          (attendanceFilter === 'absent' && item.absentCount > 0);
        return matchesSearch && matchesAttendance;
      }
      // 회차별 보기: 선택된 회차의 상태로 필터
      if (!selectedSessionId) return matchesSearch;
      const rec = recordIndex.get(`${selectedSessionId}:${item.participant.id}`);
      const matchesAttendance =
        attendanceFilter === 'all' ||
        (rec ? rec.status === attendanceFilter : false);
      return matchesSearch && matchesAttendance;
    });
  }, [
    data.participants,
    search,
    attendanceFilter,
    viewMode,
    selectedSessionId,
    recordIndex,
  ]);

  // 회차별 통계(선택된 회차)
  const sessionStats = useMemo(() => {
    const stats = { present: 0, partial: 0, absent: 0, unmarked: 0 };
    if (!selectedSessionId) return stats;
    for (const p of data.participants) {
      if (p.assignmentStatus !== 'active') continue;
      const rec = recordIndex.get(`${selectedSessionId}:${p.participant.id}`);
      if (!rec) {
        stats.unmarked += 1;
        continue;
      }
      stats[rec.status] += 1;
    }
    return stats;
  }, [data.participants, recordIndex, selectedSessionId]);

  const handleExclude = async (participantId: string, name: string) => {
    if (!window.confirm(`'${name}' 참여자를 이 수업에서 제외할까요?`)) return;
    setPendingId(participantId);
    const result = await excludeCourseParticipant(workspaceId, courseId, participantId);
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`'${name}' 참여자를 제외했습니다.`);
    router.refresh();
  };

  const handleReinclude = async (participantId: string, name: string) => {
    setPendingId(participantId);
    const result = await reincludeCourseParticipant(workspaceId, courseId, participantId);
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`'${name}' 참여자를 복구했습니다.`);
    router.refresh();
  };

  const hasSessions = data.sessionsView.sessions.length > 0;

  return (
    <section className="space-y-6">
      <section
        className="rounded-xl p-8 shadow-sm"
        style={{ background: `linear-gradient(135deg, ${accent} 0%, #1d4ed8 100%)` }}
      >
        <h2 className="text-2xl font-bold text-white">참여자 현황</h2>
        <p className="mt-1 text-sm text-blue-100">
          출석률과 참여자별 출석 상태, 특이사항을 한눈에 확인합니다. 명단은 연결된 그룹의 활성 멤버에서 자동 생성됩니다.
        </p>
      </section>

      <section className="space-y-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-start gap-4">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <CardTitle>전체 출석률</CardTitle>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {data.summary.attendanceRate !== null
                    ? `${data.summary.attendanceRate}%`
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-4">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <CardTitle>지각</CardTitle>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {data.summary.partialCount}건
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-4">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <XCircle className="h-5 w-5" />
              </span>
              <div>
                <CardTitle>결석</CardTitle>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {data.summary.absentCount}건
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 누적 / 회차별 탭 */}
      <Card className="p-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setViewMode('cumulative')}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              viewMode === 'cumulative'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            누적 보기
          </button>
          <button
            type="button"
            onClick={() => setViewMode('by-session')}
            disabled={!hasSessions}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              viewMode === 'by-session'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:text-gray-700',
              !hasSessions && 'cursor-not-allowed opacity-50',
            )}
          >
            회차별 보기
          </button>
        </div>
      </Card>

      {/* 회차별 보기일 때만 회차 선택 + 회차 통계 */}
      {viewMode === 'by-session' && hasSessions && (
        <>
          <Card className="p-4">
            <div className="flex items-center gap-3 overflow-x-auto">
              {data.sessionsView.sessions.map((s) => {
                const active = s.id === selectedSessionId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSessionId(s.id)}
                    className={cn(
                      'flex-shrink-0 rounded-lg border px-3 py-2 text-xs transition-colors',
                      active
                        ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300',
                    )}
                  >
                    {s.sessionNo}회차 · {s.date.replaceAll('-', '.')}
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <SessionStatCard label="출석" value={sessionStats.present} tone="emerald" />
            <SessionStatCard label="지각" value={sessionStats.partial} tone="amber" />
            <SessionStatCard label="결석" value={sessionStats.absent} tone="rose" />
            <SessionStatCard label="미기록" value={sessionStats.unmarked} tone="gray" />
          </div>
        </>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="참여자 이름 검색"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-gray-100 bg-gray-50 p-1 lg:flex-1">
            {ATTENDANCE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setAttendanceFilter(filter.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  attendanceFilter === filter.value
                    ? cn('bg-white shadow-sm', filter.activeClassName ?? 'text-gray-900')
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <header className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            {viewMode === 'cumulative' ? '참여자별 출석 현황 (누적)' : '참여자별 출석 현황 (회차별)'}
          </h3>
          <p className="mt-0.5 text-sm text-gray-500">
            총 {data.participants.length}명
            {viewMode === 'cumulative'
              ? ' · 최근 출석 기준'
              : selectedSessionId
                ? ` · 선택 회차의 출결 표시`
                : ''}
          </p>
        </header>

        {viewMode === 'cumulative' ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>이름</TableHead>
                <TableHead>출석 수</TableHead>
                <TableHead>지각 수</TableHead>
                <TableHead>결석 수</TableHead>
                <TableHead>최근 특이사항</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParticipants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-gray-500">
                    조건에 맞는 참여자가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredParticipants.map((item) => {
                  const rowStatus = getRowStatus(item);
                  const isExcluded = item.assignmentStatus === 'excluded';
                  return (
                    <TableRow key={item.participant.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600">
                            {getInitials(item.participant.name)}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900">{item.participant.name}</p>
                            {item.assignmentGroups.length > 0 && (
                              <p className="text-xs text-gray-400">
                                {item.assignmentGroups.map((g) => g.name).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{item.presentCount}</TableCell>
                      <TableCell>{item.partialCount}</TableCell>
                      <TableCell>{item.absentCount}</TableCell>
                      <TableCell className="max-w-xs text-gray-600">
                        {item.latestNote ?? '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge tone={rowStatus === 'normal' ? 'success' : 'warning'}>
                            {PARTICIPANT_ROW_STATUS_LABEL[rowStatus]}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {COURSE_PARTICIPANT_STATUS_LABEL[item.assignmentStatus]}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {isExcluded ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            disabled={
                              !item.canEditAssignment ||
                              pendingId === item.participant.id
                            }
                            onClick={() =>
                              handleReinclude(item.participant.id, item.participant.name)
                            }
                            aria-label={`${item.participant.name} 복구`}
                          >
                            <RotateCcw className="h-4 w-4" />
                            복구
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={
                              !item.canEditAssignment ||
                              pendingId === item.participant.id
                            }
                            onClick={() =>
                              handleExclude(item.participant.id, item.participant.name)
                            }
                            aria-label={`${item.participant.name} 제외`}
                          >
                            <Trash2 className="h-4 w-4" />
                            제외
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        ) : (
          // 회차별 보기
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>이름</TableHead>
                <TableHead>출결</TableHead>
                <TableHead>메모</TableHead>
                <TableHead>배정 그룹</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParticipants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-gray-500">
                    조건에 맞는 참여자가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredParticipants.map((item) => {
                  const rec = selectedSessionId
                    ? recordIndex.get(`${selectedSessionId}:${item.participant.id}`)
                    : undefined;
                  return (
                    <TableRow key={item.participant.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600">
                            {getInitials(item.participant.name)}
                          </span>
                          <p className="font-medium text-gray-900">{item.participant.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rec ? (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium',
                              STATUS_TONE[rec.status],
                            )}
                          >
                            {STATUS_LABEL[rec.status]}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">미기록</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs text-sm text-gray-600">
                        {rec?.note ?? '-'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {item.assignmentGroups.length > 0
                          ? item.assignmentGroups.map((g) => g.name).join(', ')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </section>
  );
}

function SessionStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'amber' | 'rose' | 'gray';
}) {
  const valueColor = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    gray: 'text-gray-500',
  }[tone];
  return (
    <Card>
      <CardContent>
        <CardTitle>{label}</CardTitle>
        <p className={cn('mt-1 text-2xl font-bold', valueColor)}>{value}명</p>
      </CardContent>
    </Card>
  );
}
