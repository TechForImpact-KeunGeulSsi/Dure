'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type {
  GroupSummary,
  MaterialListItem,
  MaterialVisibilityScope,
} from '@/lib/api/types';
import {
  completeMaterialUpload,
  replaceMaterialFile,
  updateMaterial,
} from '@/services/materials';

import { VisibilityFields } from './visibility-fields';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  courseId: string;
  material: MaterialListItem;
  availableGroups: GroupSummary[];
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
  courseId,
  material,
  availableGroups,
  uploadPolicy,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(material.title);
  const [description, setDescription] = useState(material.description ?? '');
  const [scope, setScope] = useState<MaterialVisibilityScope>(material.visibilityScope);
  const [groupIds, setGroupIds] = useState<string[]>(
    material.visibleGroups.map((g) => g.id),
  );
  const [submitting, setSubmitting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => onOpenChange(false);

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    const result = await updateMaterial(workspaceId, material.id, {
      title: title.trim() === material.title ? undefined : title.trim(),
      description: description.trim() === (material.description ?? '') ? undefined : (description.trim() || null),
      visibilityScope: scope === material.visibilityScope ? undefined : scope,
      visibleGroupIds: scope === 'selected_groups' ? groupIds : undefined,
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

    const prep = await replaceMaterialFile(workspaceId, material.id, {
      originalFilename: f.name,
      mimeType: f.type,
      sizeBytes: f.size,
    });
    if (!prep.ok) {
      setReplacing(false);
      setError(prep.error.message);
      return;
    }

    const uploaded = await putFileToSignedUrl(prep.data.signedUploadUrl, f);
    if (!uploaded) {
      setReplacing(false);
      setError('파일 업로드에 실패했습니다.');
      return;
    }

    const done = await completeMaterialUpload(workspaceId, material.id);
    setReplacing(false);
    if (!done.ok) {
      setError(done.error.message);
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

        <VisibilityFields
          scope={scope}
          onScopeChange={setScope}
          groupIds={groupIds}
          onGroupIdsChange={setGroupIds}
          availableGroups={availableGroups}
        />

        {material.canReplaceFile && (
          <div className="space-y-1.5 border-t border-gray-100 pt-4">
            <Label>파일 교체</Label>
            <p className="text-xs text-gray-500">
              현재 파일: {material.originalFilename ?? '—'}
            </p>
            <Input
              type="file"
              accept={uploadPolicy.allowedMimeTypes.join(',')}
              onChange={handleReplaceFile}
              disabled={replacing}
            />
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

async function putFileToSignedUrl(url: string, file: File): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}