'use client';

import { ChevronDown, ChevronRight, FileText, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { saveClassMemo } from '@/services/attendance';
import type {
  GetCourseMemosOutput,
  SessionMemoItem,
} from '@/services/class-memos';

type Props = {
  workspaceId: string;
  courseId: string;
  initial: GetCourseMemosOutput;
};

type FilterMode = 'all' | 'with_memo' | 'empty';

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'with_memo', label: '메모 있음' },
  { value: 'empty', label: '메모 없음' },
];

export function NotesClient({ workspaceId, courseId, initial }: Props) {
  const accent = initial.course.cardColor ?? '#2563EB';
  const [filter, setFilter] = useState<FilterMode>('all');

  const filtered = useMemo(() => {
    return initial.items.filter((item) => {
      if (filter === 'with_memo') return item.memo.content.trim().length > 0;
      if (filter === 'empty') return item.memo.content.trim().length === 0;
      return true;
    });
  }, [initial.items, filter]);

  const withMemoCount = initial.items.filter(
    (i) => i.memo.content.trim().length > 0,
  ).length;

  return (
    <section className="space-y-6">
      <Banner accent={accent} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard label="전체 회차" value={`${initial.items.length}회차`} tone="blue" />
        <StatCard label="메모 작성됨" value={`${withMemoCount}회차`} tone="emerald" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-1 rounded-lg border border-gray-100 bg-gray-50 p-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                filter === opt.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-gray-500">
            {initial.items.length === 0
              ? '아직 등록된 회차가 없습니다.'
              : '조건에 맞는 회차가 없습니다.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <SessionMemoRow
              key={item.session.id}
              workspaceId={workspaceId}
              courseId={courseId}
              item={item}
              canSave={initial.canSaveMemo}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SessionMemoRow({
  workspaceId,
  item,
  canSave,
}: {
  workspaceId: string;
  courseId: string;
  item: SessionMemoItem;
  canSave: boolean;
}) {
  const router = useRouter();
  const hasMemo = item.memo.content.trim().length > 0;
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(item.memo.content);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const result = await saveClassMemo(workspaceId, {
      sessionId: item.session.id,
      content,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('메모를 저장했습니다.');
    router.refresh();
  };

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-gray-50"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {item.session.sessionNo}회차
            </span>
            <span className="text-xs text-gray-500">
              {item.session.date.replaceAll('-', '.')} ·{' '}
              {item.session.startsAt.slice(0, 5)}~{item.session.endsAt.slice(0, 5)}
            </span>
            {item.session.type !== 'regular' && <Badge tone="neutral">보강</Badge>}
            {hasMemo ? (
              <Badge tone="success">메모</Badge>
            ) : (
              <Badge tone="neutral">메모 없음</Badge>
            )}
          </div>
          {!open && hasMemo && (
            <p className="mt-1 truncate text-xs text-gray-500">{item.memo.content}</p>
          )}
        </div>
        <FileText className="h-4 w-4 flex-shrink-0 text-gray-300" />
      </button>

      {open && (
        <CardContent className="border-t border-gray-100">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            placeholder="이 회차의 메모를 작성하세요."
            className="mt-1"
            maxLength={5000}
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {item.memo.updatedBy && item.memo.updatedAt
                ? `마지막 수정: ${item.memo.updatedBy.displayName ?? item.memo.updatedBy.email} · ${formatDateTime(item.memo.updatedAt)}`
                : '아직 저장된 메모가 없습니다.'}
            </p>
            {canSave && (
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? '저장 중...' : '저장'}
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function Banner({ accent }: { accent: string }) {
  return (
    <section
      className="rounded-xl p-8 shadow-sm"
      style={{ background: `linear-gradient(135deg, ${accent} 0%, #1d4ed8 100%)` }}
    >
      <h2 className="text-2xl font-bold text-white">수업 메모</h2>
      <p className="mt-1 text-sm text-blue-100">
        모든 회차의 메모를 한눈에 보고, 필요한 회차의 메모를 바로 편집하세요.
      </p>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'emerald';
}) {
  const valueColor = { blue: 'text-blue-600', emerald: 'text-emerald-600' }[tone];
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