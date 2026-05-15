'use client';

import { CheckCircle2, Circle, Download, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { materialReviewStatusLabel } from '@/lib/api/labels';
import type { MaterialListItem } from '@/lib/api/types';

type Props = {
  workspaceId: string;
  material: MaterialListItem;
  onToggleReview: (m: MaterialListItem) => Promise<void> | void;
  onEdit: () => void;
};

export function MaterialRow({ workspaceId, material, onToggleReview, onEdit }: Props) {
  const handleDownload = async () => {
    const res = await fetch(
      `/api/materials/${material.id}/download?workspaceId=${workspaceId}`,
    );
    const json = await res.json();
    if (!json.ok) {
      toast.error(json.error?.message ?? '다운로드 URL을 받지 못했습니다.');
      return;
    }
    window.open(json.data.signedDownloadUrl, '_blank', 'noopener');
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <Title material={material} />
          <Meta material={material} />
          <Visibility material={material} />
        </div>
        <div className="flex items-center gap-1">
          {material.canDownload && material.uploadStatus === 'uploaded' && (
            <Button variant="ghost" size="icon" onClick={handleDownload} title="다운로드">
              <Download className="h-4 w-4" />
            </Button>
          )}
          {material.canChangeReviewStatus && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleReview(material)}
              title={material.reviewStatus === 'reviewed' ? '확인 취소' : '확인 처리'}
            >
              {material.reviewStatus === 'reviewed' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4 text-gray-400" />
              )}
            </Button>
          )}
          {material.canEdit && (
            <Button variant="ghost" size="icon" onClick={onEdit} title="수정">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function Title({ material }: { material: MaterialListItem }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="truncate text-sm font-semibold text-gray-900">{material.title}</h3>
      <Badge tone={material.reviewStatus === 'reviewed' ? 'success' : 'warning'}>
        {materialReviewStatusLabel(material.reviewStatus)}
      </Badge>
      {material.uploadStatus !== 'uploaded' && <Badge tone="neutral">업로드 중</Badge>}
    </div>
  );
}

function Meta({ material }: { material: MaterialListItem }) {
  const uploader = material.uploadedBy?.displayName ?? material.uploadedBy?.email ?? '—';
  return (
    <p className="mt-1 truncate text-xs text-gray-500">
      {material.originalFilename ?? '—'} · {formatBytes(material.sizeBytes)} · 업로더 {uploader}
    </p>
  );
}

function Visibility({ material }: { material: MaterialListItem }) {
  const label =
    material.visibilityScope === 'all_course_groups'
      ? '전체 연결 그룹'
      : material.visibleGroups.map((g) => g.name).join(', ') || '지정 그룹 없음';
  return <p className="mt-1 text-xs text-gray-400">공개 범위: {label}</p>;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}