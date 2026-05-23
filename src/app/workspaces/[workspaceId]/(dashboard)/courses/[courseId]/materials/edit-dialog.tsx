'use client';

import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type {
  MaterialListItem,
  MaterialVisibilityScope,
} from '@/lib/api/types';
import { replaceMaterialFile, updateMaterial } from '@/services/materials';

import { VisibilityFields } from './visibility-fields';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  courseId: string;
  material: MaterialListItem;
  uploadPolicy: {
    maxSizeBytes: number;
    allowedExtensions: string[];
    allowedMimeTypes: string[];
  };
};

export function EditDialog({
  open,
  onOpenChange,
  workspaceId,
  material,
  uploadPolicy,
}: Props) {
  const router = useRouter();
  const replaceFileInputId = useId();
  const [title, setTitle] = useState(material.title);
  const [description, setDescription] = useState(material.description ?? '');
  const [scope, setScope] = useState<MaterialVisibilityScope>(material.visibilityScope);
  const [submitting, setSubmitting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => onOpenChange(false);

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    const result = await updateMaterial(workspaceId, material.id, {
      title: title.trim() === material.title ? undefined : title.trim(),
      description:
        description.trim() === (material.description ?? '')
          ? undefined
          : description.trim() || null,
      visibilityScope: scope === material.visibilityScope ? undefined : scope,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success('자료를 수정했습니다.');
    router.refresh();
    close();
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 가능하게
    if (!f) return;

    setReplacing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', f);

    const result = await replaceMaterialFile(workspaceId, material.id, formData);
    setReplacing(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success('파일을 교체했습니다.');
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogHeader title="자료 수정" />
      <DialogBody>
        <div className="space-y-1.5">
          <Label htmlFor="title">제목</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">설명</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
          />
        </div>

        <VisibilityFields scope={scope} onScopeChange={setScope} />

        {material.canReplaceFile && (
          <div className="space-y-1.5 border-t border-gray-100 pt-4">
            <Label>파일 교체</Label>
            <p className="text-xs text-gray-500">
              현재 파일: {material.originalFilename ?? '—'}
            </p>
            <input
              id={replaceFileInputId}
              type="file"
              accept={uploadPolicy.allowedMimeTypes.join(',')}
              onChange={handleReplaceFile}
              disabled={replacing}
              className="sr-only"
            />
            <label
              htmlFor={replacing ? undefined : replaceFileInputId}
              className={`flex min-h-20 items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-white px-4 py-3 transition-colors ${
                replacing
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer hover:bg-[var(--color-muted)]'
              }`}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-foreground)]">
                <Upload className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--color-foreground)]">
                  새 파일 선택
                </span>
                <span className="block text-xs text-[var(--color-muted-foreground)]">
                  {formatMB(uploadPolicy.maxSizeBytes)} 이하
                </span>
              </span>
            </label>
            {replacing && <p className="text-xs text-gray-500">교체 중...</p>}
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={close} disabled={submitting || replacing}>
          취소
        </Button>
        <Button onClick={handleSave} disabled={submitting || replacing}>
          {submitting ? '저장 중...' : '저장'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function formatMB(bytes: number): string {
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
