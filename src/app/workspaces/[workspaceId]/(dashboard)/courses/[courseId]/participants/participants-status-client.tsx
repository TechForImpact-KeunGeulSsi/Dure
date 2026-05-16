'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Plus,
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
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
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
  addCourseParticipants,
  excludeCourseParticipant,
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

const ATTENDANCE_FILTERS: {
  value: AttendanceFilter;
  label: string;
  activeClassName?: string;
}[] = [
  { value: 'all', label: '전체', activeClassName: 'text-blue-600' },
  { value: 'present', label: '출석', activeClassName: 'text-green-600' },
  { value: 'partial', label: '부분 출석', activeClassName: 'text-amber-600' },
  { value: 'absent', label: '결석', activeClassName: 'text-red-600' },
];

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
  const [addOpen, setAddOpen] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [excludingId, setExcludingId] = useState<string | null>(null);

  const filteredParticipants = useMemo(() => {
    return data.participants.filter((item) => {
      const matchesSearch =
        search.trim() === '' ||
        item.participant.name.toLowerCase().includes(search.trim().toLowerCase());
      const matchesAttendance =
        attendanceFilter === 'all' ||
        (attendanceFilter === 'present' && item.presentCount > 0) ||
        (attendanceFilter === 'partial' && item.partialCount > 0) ||
        (attendanceFilter === 'absent' && item.absentCount > 0);
      return matchesSearch && matchesAttendance;
    });
  }, [data.participants, search, attendanceFilter]);

  const handleExclude = async (courseParticipantId: string, name: string) => {
    if (!window.confirm(`'${name}' 참여자를 이 수업에서 제외할까요?`)) return;
    setExcludingId(courseParticipantId);
    const result = await excludeCourseParticipant(workspaceId, courseParticipantId);
    setExcludingId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`'${name}' 참여자를 제외했습니다.`);
    router.refresh();
  };

  const toggleSelect = (id: string) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const closeAddDialog = () => {
    setAddOpen(false);
    setTimeout(() => setSelectedToAdd(new Set()), 200);
  };

  const handleAdd = async () => {
    if (selectedToAdd.size === 0) {
      toast.error('추가할 참여자를 1명 이상 선택해 주세요.');
      return;
    }
    setAdding(true);
    const result = await addCourseParticipants(
      workspaceId,
      courseId,
      Array.from(selectedToAdd),
    );
    setAdding(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`참여자 ${result.data.addedCount}명을 추가했습니다.`);
    closeAddDialog();
    router.refresh();
  };

  return (
    <section className="space-y-6">
      <section
        className="rounded-xl p-8 shadow-sm"
        style={{ background: `linear-gradient(135deg, ${accent} 0%, #1d4ed8 100%)` }}
      >
        <h2 className="text-2xl font-bold text-white">참여자 현황</h2>
        <p className="mt-1 text-sm text-blue-100">
          출석률과 참여자별 출석 상태, 특이사항을 한눈에 확인합니다.
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
                <CardTitle>부분 출석</CardTitle>
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
          <Button type="button" className="flex-shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            참여자 추가
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <header className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">참여자별 출석 현황</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            총 {data.participants.length}명 · 최근 출석 기준
          </p>
        </header>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>이름</TableHead>
              <TableHead>출석 수</TableHead>
              <TableHead>부분 출석 수</TableHead>
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
                return (
                  <TableRow key={item.courseParticipantId}>
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={
                          item.assignmentStatus === 'excluded' ||
                          !item.canEditAssignment ||
                          excludingId === item.courseParticipantId
                        }
                        onClick={() => handleExclude(item.courseParticipantId, item.participant.name)}
                        aria-label={`${item.participant.name} 제외`}
                      >
                        <Trash2 className="h-4 w-4" />
                        제외
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addOpen} onOpenChange={closeAddDialog}>
        <DialogHeader
          title="참여자 추가"
          description="이 수업의 연결 그룹에 속한 참여자 중 아직 배정되지 않은 사람을 선택합니다."
        />
        <DialogBody>
          {data.eligibleParticipants.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              추가할 수 있는 참여자가 없습니다. 운영 메뉴에서 참여자를 먼저 그룹에 배정해
              주세요.
            </p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {data.eligibleParticipants.map((p) => {
                const checked = selectedToAdd.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors',
                      checked
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(p.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                      <p className="truncate text-xs text-gray-500">
                        {p.groups.map((g) => g.name).join(', ')}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500">
            선택됨: {selectedToAdd.size}명
          </p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={closeAddDialog} disabled={adding}>
            취소
          </Button>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={adding || selectedToAdd.size === 0}
          >
            {adding ? '추가 중...' : `${selectedToAdd.size}명 추가`}
          </Button>
        </DialogFooter>
      </Dialog>
    </section>
  );
}
