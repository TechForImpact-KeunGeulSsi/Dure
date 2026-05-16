'use client';

import { Save, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { AttendanceStatus } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import {
  saveAttendance,
  saveClassMemo,
  type GetAttendanceBookOutput,
} from '@/services/attendance';

type Props = {
  workspaceId: string;
  courseId: string;
  initial: GetAttendanceBookOutput;
};

type LocalRecord = {
  participantId: string;
  status: AttendanceStatus;
  note: string;
};

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; tone: string }[] = [
  { value: 'present', label: '출석', tone: 'bg-emerald-500 hover:bg-emerald-600' },
  { value: 'partial', label: '지각', tone: 'bg-amber-500 hover:bg-amber-600' },
  { value: 'absent', label: '결석', tone: 'bg-rose-500 hover:bg-rose-600' },
];

export function AttendanceClient({ workspaceId, courseId, initial }: Props) {
  const router = useRouter();
  const accent = initial.course.cardColor ?? '#2563EB';
  const selected = initial.selectedSession;

  const [records, setRecords] = useState<Record<string, LocalRecord>>(() => {
    const init: Record<string, LocalRecord> = {};
    for (const t of initial.targets) {
      init[t.participantId] = {
        participantId: t.participantId,
        status: t.record?.status ?? 'present',
        note: t.record?.note ?? '',
      };
    }
    return init;
  });

  const [memo, setMemo] = useState(initial.classMemo.content);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingMemo, setSavingMemo] = useState(false);

  const stats = useMemo(() => {
    const list = Object.values(records);
    return {
      present: list.filter((r) => r.status === 'present').length,
      partial: list.filter((r) => r.status === 'partial').length,
      absent: list.filter((r) => r.status === 'absent').length,
    };
  }, [records]);

  const handleStatus = (participantId: string, status: AttendanceStatus) => {
    setRecords((prev) => ({
      ...prev,
      [participantId]: { ...prev[participantId], status },
    }));
  };

  const handleNote = (participantId: string, note: string) => {
    setRecords((prev) => ({
      ...prev,
      [participantId]: { ...prev[participantId], note },
    }));
  };

  const handleSaveAttendance = async () => {
    if (!selected) return;
    setSavingAttendance(true);
    const result = await saveAttendance(workspaceId, {
      sessionId: selected.id,
      records: Object.values(records).map((r) => ({
        participantId: r.participantId,
        status: r.status,
        note: r.note.trim() || null,
      })),
    });
    setSavingAttendance(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('출석을 저장했습니다.');
    router.refresh();
  };

  const handleSaveMemo = async () => {
    if (!selected) return;
    setSavingMemo(true);
    const result = await saveClassMemo(workspaceId, {
      sessionId: selected.id,
      content: memo,
    });
    setSavingMemo(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('수업 메모를 저장했습니다.');
    router.refresh();
  };

  if (!selected) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-gray-500">출석을 기록할 회차가 없습니다.</p>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <Banner accent={accent} />

      <SessionPicker
        workspaceId={workspaceId}
        courseId={courseId}
        sessions={initial.sessions}
        selectedId={selected.id}
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="출석" value={`${stats.present}명`} tone="emerald" />
        <StatCard label="지각" value={`${stats.partial}명`} tone="amber" />
        <StatCard label="결석" value={`${stats.absent}명`} tone="rose" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">
              참여자 출석 ({initial.targets.length}명)
            </h3>
          </div>
          {initial.canSaveAttendance && (
            <Button onClick={handleSaveAttendance} disabled={savingAttendance}>
              <Save className="h-4 w-4" />
              {savingAttendance ? '저장 중...' : '출석 저장'}
            </Button>
          )}
        </div>
        {initial.targets.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            이 수업의 활성 참여자가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {initial.targets.map((t) => (
              <ParticipantRow
                key={t.participantId}
                target={t}
                record={records[t.participantId]}
                onStatusChange={handleStatus}
                onNoteChange={handleNote}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <CardTitle>수업 메모</CardTitle>
            {initial.canSaveMemo && (
              <Button variant="secondary" onClick={handleSaveMemo} disabled={savingMemo}>
                {savingMemo ? '저장 중...' : '메모 저장'}
              </Button>
            )}
          </div>
          <Textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={5}
            placeholder="회차 진행에 대한 메모를 남겨 주세요."
            className="mt-3"
            maxLength={5000}
          />
          {initial.classMemo.updatedBy && initial.classMemo.updatedAt && (
            <p className="mt-2 text-xs text-gray-400">
              마지막 수정:{' '}
              {initial.classMemo.updatedBy.displayName ?? initial.classMemo.updatedBy.email} ·{' '}
              {formatDateTime(initial.classMemo.updatedAt)}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function Banner({ accent }: { accent: string }) {
  return (
    <section
      className="rounded-xl p-8 shadow-sm"
      style={{ background: `linear-gradient(135deg, ${accent} 0%, #1d4ed8 100%)` }}
    >
      <h2 className="text-2xl font-bold text-white">출석부</h2>
      <p className="mt-1 text-sm text-blue-100">
        회차별 참여자 출석을 기록하고 수업 메모를 남기세요.
      </p>
    </section>
  );
}

function SessionPicker(props: {
  workspaceId: string;
  courseId: string;
  sessions: GetAttendanceBookOutput['sessions'];
  selectedId: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 overflow-x-auto">
        {props.sessions.map((s) => {
          const active = s.id === props.selectedId;
          const href = `/workspaces/${props.workspaceId}/teach/courses/${props.courseId}/attendance?session=${s.id}`;
          return (
            <a
              key={s.id}
              href={href}
              className={cn(
                'flex-shrink-0 rounded-lg border px-3 py-2 text-xs transition-colors',
                active
                  ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {s.sessionNo}회차 · {s.date.replaceAll('-', '.')}
            </a>
          );
        })}
      </div>
    </Card>
  );
}

function ParticipantRow({
  target,
  record,
  onStatusChange,
  onNoteChange,
}: {
  target: GetAttendanceBookOutput['targets'][number];
  record: LocalRecord;
  onStatusChange: (id: string, status: AttendanceStatus) => void;
  onNoteChange: (id: string, note: string) => void;
}) {
  return (
    <li className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{target.participantName}</span>
          {target.assignmentGroups.slice(0, 2).map((g) => (
            <Badge key={g.id} tone="neutral">
              {g.name}
            </Badge>
          ))}
        </div>
        <input
          type="text"
          value={record.note}
          onChange={(e) => onNoteChange(target.participantId, e.target.value)}
          placeholder="메모 (선택)"
          maxLength={500}
          className="mt-1.5 w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
        />
      </div>
      <div className="flex gap-1.5">
        {STATUS_OPTIONS.map((opt) => {
          const active = record.status === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStatusChange(target.participantId, opt.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? `text-white ${opt.tone}`
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </li>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'emerald' | 'amber' | 'rose';
}) {
  const valueColor = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
  }[tone];
  return (
    <Card>
      <CardContent>
        <CardTitle>{label}</CardTitle>
        <p className={cn('mt-1 text-2xl font-bold', valueColor)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}