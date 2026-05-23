'use client';

import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { MaterialVisibilityScope } from '@/lib/api/types';
import { uploadMaterial } from '@/services/materials';

import { VisibilityFields } from './visibility-fields';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  courseId: string;
  uploadPolicy: {
    maxSizeBytes: number;
    allowedExtensions: string[];
    allowedMimeTypes: string[];
  };
};

export function UploadDialog({
  open,
  onOpenChange,
  workspaceId,
  courseId,
  uploadPolicy,
}: Props) {
  const router = useRouter();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<MaterialVisibilityScope>('admin_only');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFile(null);
    setTitle('');
    setDescription('');
    setScope('admin_only');
    setSubmitting(false);
    setError(null);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !title.trim()) setTitle(stripExtension(f.name));
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('파일을 선택해 주세요.');
      return;
    }
    if (!title.trim()) {
      setError('제목을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title.trim());
    if (description.trim()) formData.append('description', description.trim());
    formData.append('visibilityScope', scope);

    const result = await uploadMaterial(workspaceId, courseId, formData);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    toast.success('자료가 등록되었습니다.');
    router.refresh();
    close();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogHeader
        title="자료 추가"
        description={`최대 ${formatMB(uploadPolicy.maxSizeBytes)}, 허용 확장자: ${uploadPolicy.allowedExtensions.join(', ')}`}
      />
      <DialogBody>
        <div className="space-y-1.5">
          <Label htmlFor={fileInputId}>파일</Label>
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept={uploadPolicy.allowedMimeTypes.join(',')}
            onChange={handleFileChange}
            className="sr-only"
          />
          <label
            htmlFor={fileInputId}
            className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-white px-4 py-5 text-center transition-colors hover:bg-[var(--color-muted)] focus-within:border-[var(--color-ring)] focus-within:ring-2 focus-within:ring-[var(--color-ring)]/20"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-foreground)]">
              <Upload className="size-4" />
            </span>
            <span className="text-sm font-medium text-[var(--color-foreground)]">
              {file ? file.name : '파일 선택'}
            </span>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {file
                ? formatMB(file.size)
                : `${formatMB(uploadPolicy.maxSizeBytes)} 이하`}
            </span>
          </label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title">제목</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="자료 제목"
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">설명 (선택)</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
          />
        </div>

        <VisibilityFields scope={scope} onScopeChange={setScope} />

        {error && <p className="text-sm text-rose-600">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={close} disabled={submitting}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? '업로드 중...' : '업로드'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function formatMB(bytes: number): string {
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}
