'use client';

import { Label } from '@/components/ui/label';
import type { MaterialVisibilityScope } from '@/lib/api/types';

type Props = {
  scope: MaterialVisibilityScope;
  onScopeChange: (s: MaterialVisibilityScope) => void;
};

export function VisibilityFields({ scope, onScopeChange }: Props) {
  return (
    <div className="space-y-2">
      <Label>공개 범위</Label>
      <div className="space-y-2 text-sm">
        <Option
          checked={scope === 'admin_only'}
          onChange={() => onScopeChange('admin_only')}
          label="관리자에게만 공개"
          description="대표 운영자와 그룹 운영자만 다운로드할 수 있어요. 업로더 본인은 항상 접근 가능합니다."
        />
        <Option
          checked={scope === 'public'}
          onChange={() => onScopeChange('public')}
          label="전체 공개"
          description="로그인하지 않은 외부 사용자도 다운로드할 수 있어요."
        />
      </div>
    </div>
  );
}

function Option({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-gray-200 bg-white p-3 hover:border-blue-300">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 accent-blue-600"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
    </label>
  );
}
