import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { GroupSummary } from '@/types/course';
import type { CalendarItem } from '@/types/calendar';
import { SESSION_CHIP_STYLES } from '@/types/calendar';

export function formatGroupBracket(groups?: GroupSummary[] | null): string {
  const names = (groups ?? [])
    .map((group) => group?.name?.trim())
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return '';
  return ` [${names.join(', ')}]`;
}

export function formatCourseSessionLabel(
  courseName: string | undefined | null,
  groups?: GroupSummary[] | null,
): string {
  const title = courseName?.trim() || '수업';
  return `${title}${formatGroupBracket(groups)}`;
}

function getGroupNames(groups?: GroupSummary[] | null): string[] {
  return (groups ?? [])
    .map((group) => group?.name?.trim())
    .filter((name): name is string => Boolean(name));
}

type CalendarChipProps = {
  item: CalendarItem;
  onRemove?: () => void;
};

function getChipLabel(item: CalendarItem) {
  if (item.kind === 'course_session') {
    return formatCourseSessionLabel(item.session?.courseName, item.groups);
  }
  return item.item?.title ?? '';
}

function getChipClassName(item: CalendarItem) {
  if (item.kind === 'course_session') {
    return SESSION_CHIP_STYLES[item.session.type];
  }
  const color = item.item.color;
  if (color === '#F97316' || color === '#EA580C') {
    return 'bg-orange-100 text-orange-700';
  }
  return 'bg-gray-100 text-gray-700';
}

export function CalendarChip({ item, onRemove }: CalendarChipProps) {
  const label = getChipLabel(item);
  const groupNames =
    item.kind === 'course_session' ? getGroupNames(item.groups) : [];

  return (
    <span
      className={cn(
        'flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight',
        getChipClassName(item),
      )}
      title={label}
    >
      {item.kind === 'course_session' ? (
        <>
          <span className="min-w-0 truncate">{item.session?.courseName?.trim() || '수업'}</span>
          {groupNames.length > 0 ? (
            <span className="shrink-0 rounded bg-white/50 px-1 text-[10px] font-semibold leading-none">
              [{groupNames.join(', ')}]
            </span>
          ) : null}
        </>
      ) : (
        <span className="truncate">{label}</span>
      )}
      {onRemove ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="flex-shrink-0 rounded hover:bg-black/10"
          aria-label="일정 제거"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}
