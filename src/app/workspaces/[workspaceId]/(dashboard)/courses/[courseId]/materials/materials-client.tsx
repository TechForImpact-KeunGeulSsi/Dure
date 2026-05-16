'use client';

import { Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { materialReviewStatusLabel } from '@/lib/api/labels';
import type { MaterialListItem, MaterialReviewStatus } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import {
  deleteMaterial,
  updateMaterialReviewStatus,
  type GetCourseMaterialsOutput,
} from '@/services/materials';

import { EditDialog } from './edit-dialog';
import { MaterialRow } from './material-row';
import { UploadDialog } from './upload-dialog';

type Props = {
  workspaceId: string;
  courseId: string;
  initial: GetCourseMaterialsOutput;
};

type ReviewFilter = 'all' | MaterialReviewStatus;

const REVIEW_FILTERS: { value: ReviewFilter; label: string; activeClassName?: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '미확인', activeClassName: 'text-amber-600' },
  { value: 'reviewed', label: '확인됨', activeClassName: 'text-emerald-600' },
];

export function MaterialsClient({ workspaceId, courseId, initial }: Props) {
  const router = useRouter();
  const accent = initial.course.cardColor ?? '#2563EB';
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialListItem | null>(null);

  const filtered = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    return initial.materials.filter((m) => {
      if (filter !== 'all' && m.reviewStatus !== filter) return false;
      if (trimmed && !m.title.toLowerCase().includes(trimmed)) return false;
      return true;
    });
  }, [initial.materials, filter, search]);

  const pendingCount = initial.materials.filter((m) => m.reviewStatus === 'pending').length;
  const reviewedCount = initial.materials.filter((m) => m.reviewStatus === 'reviewed').length;

  const handleToggleReview = async (m: MaterialListItem) => {
    const next: MaterialReviewStatus = m.reviewStatus === 'reviewed' ? 'pending' : 'reviewed';
    const result = await updateMaterialReviewStatus(workspaceId, m.id, { reviewStatus: next });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`${materialReviewStatusLabel(next)}으로 변경했습니다.`);
    router.refresh();
  };

  const handleDelete = async (m: MaterialListItem) => {
    const result = await deleteMaterial(workspaceId, m.id);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('자료를 삭제했습니다.');
    router.refresh();
  };

  return (
    <section className="space-y-6">
      <Banner accent={accent} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard label="미확인" value={`${pendingCount}건`} tone="amber" />
        <StatCard label="확인됨" value={`${reviewedCount}건`} tone="emerald" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        canCreate={initial.canCreateMaterial}
        onAddClick={() => setUploadOpen(true)}
      />

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-gray-500">
            {initial.materials.length === 0
              ? '아직 등록된 자료가 없습니다.'
              : '조건에 맞는 자료가 없습니다.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <MaterialRow
              key={m.id}
              workspaceId={workspaceId}
              material={m}
              onToggleReview={handleToggleReview}
              onEdit={() => setEditing(m)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        workspaceId={workspaceId}
        courseId={courseId}
        availableGroups={initial.course.groups}
        uploadPolicy={initial.uploadPolicy}
      />

      {editing && (
        <EditDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          workspaceId={workspaceId}
          courseId={courseId}
          material={editing}
          availableGroups={initial.course.groups}
          uploadPolicy={initial.uploadPolicy}
        />
      )}
    </section>
  );
}

function Banner({ accent }: { accent: string }) {
  return (
    <section
      className="rounded-xl p-8 shadow-sm"
      style={{ background: `linear-gradient(135deg, ${accent} 0%, #1d4ed8 100%)` }}
    >
      <h2 className="text-2xl font-bold text-white">수업 자료</h2>
      <p className="mt-1 text-sm text-blue-100">
        수업 참여 그룹에 공유할 자료를 업로드하고, 운영자가 검토 상태를 관리합니다.
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
  tone: 'amber' | 'emerald';
}) {
  const valueColor = tone === 'amber' ? 'text-amber-600' : 'text-emerald-600';
  return (
    <Card>
      <CardContent>
        <CardTitle>{label}</CardTitle>
        <p className={cn('mt-1 text-2xl font-bold', valueColor)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterBar(props: {
  search: string;
  onSearchChange: (v: string) => void;
  filter: ReviewFilter;
  onFilterChange: (f: ReviewFilter) => void;
  canCreate: boolean;
  onAddClick: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="자료 제목 검색"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-gray-100 bg-gray-50 p-1 lg:flex-1">
          {REVIEW_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => props.onFilterChange(f.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                props.filter === f.value
                  ? cn('bg-white shadow-sm', f.activeClassName ?? 'text-gray-900')
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {props.canCreate && (
          <Button type="button" className="flex-shrink-0" onClick={props.onAddClick}>
            <Plus className="h-4 w-4" />
            자료 추가
          </Button>
        )}
      </div>
    </Card>
  );
}