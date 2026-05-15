import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { CalendarItem } from '@/types/calendar';
import { SESSION_CHIP_STYLES } from '@/types/calendar';

type CalendarChipProps = {
  item: CalendarItem;
  onRemove?: () => void;
};

function getChipLabel(item: CalendarItem) {
  if (item.kind === 'course_session') {
    return item.session.courseName;
  }
  return item.item.title;
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
  return (
    <span
      className={cn(
        'flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight',
        getChipClassName(item),
      )}
      title={getChipLabel(item)}
    >
      <span className="truncate">{getChipLabel(item)}</span>
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
