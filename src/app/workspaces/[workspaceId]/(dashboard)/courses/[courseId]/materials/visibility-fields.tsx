'use client';

import { Label } from '@/components/ui/label';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import type { GroupSummary, MaterialVisibilityScope } from '@/lib/api/types';

type Props = {
  scope: MaterialVisibilityScope;
  onScopeChange: (s: MaterialVisibilityScope) => void;
  groupIds: string[];
  onGroupIdsChange: (ids: string[]) => void;
  availableGroups: GroupSummary[];
  error?: string;
};

export function VisibilityFields({
  scope,
  onScopeChange,
  groupIds,
  onGroupIdsChange,
  availableGroups,
  error,
}: Props) {
  const options: MultiSelectOption[] = availableGroups.map((g) => ({
    id: g.id,
    label: g.name,
  }));

  return (
    <div className="space-y-2">
      <Label>공개 범위</Label>
      <div className="space-y-1.5 text-sm">
        <Option
          checked={scope === 'all_course_groups'}
          onChange={() => onScopeChange('all_course_groups')}
          label="이 수업의 전체 연결 그룹에 공개"
        />
        <Option
          checked={scope === 'selected_groups'}
          onChange={() => onScopeChange('selected_groups')}
          label="선택한 그룹에만 공개"
        />
      </div>

      {scope === 'selected_groups' && (
        <div className="pt-1">
          <MultiSelect
            options={options}
            selectedIds={groupIds}
            onChange={onGroupIdsChange}
            placeholder="공개 그룹 선택"
          />
        </div>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function Option({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-gray-700">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-blue-600"
      />
      <span>{label}</span>
    </label>
  );
}