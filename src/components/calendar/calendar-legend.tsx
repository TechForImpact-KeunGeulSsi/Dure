import { LEGEND_ITEMS, SESSION_CHIP_STYLES } from '@/types/calendar';

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
      <span className="font-medium text-gray-600">범례</span>
      {LEGEND_ITEMS.map((item) => (
        <span key={item.type} className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${SESSION_CHIP_STYLES[item.type].split(' ')[0]}`}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
