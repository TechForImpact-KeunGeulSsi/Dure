import type { ReactNode } from 'react';

import type {
  MonthlyTrendRow,
  ParticipationBreakdownRow,
} from '@/services/participation-report-logic';

// 제출 문서(인쇄·PDF)용 정적 그래프. 축은 하나, 숫자는 막대에 직접 적는다.
// 색은 흑백 인쇄와 색각 이상에서도 구분되도록 검증한 두 색(파랑·주황)만 쓴다.
const PRIMARY = '#1d4ed8';
const SECONDARY = '#d97706';
const UNKNOWN = '#9ca3af';
const INK = '#111827';
const MUTED = '#4b5563';
const GRID = '#e5e7eb';
const WIDTH = 680;

type CourseRow = { courseId: string; courseName: string; uniqueParticipants: number; attendanceCount: number };

export function ReportCharts({
  periodLabel,
  trend,
  byCourse,
  byGender,
  byDisability,
  byAgeBand,
}: {
  periodLabel: string;
  trend: MonthlyTrendRow[];
  byCourse: CourseRow[];
  byGender: ParticipationBreakdownRow[];
  byDisability: ParticipationBreakdownRow[];
  byAgeBand: ParticipationBreakdownRow[];
}) {
  const note = `${periodLabel} · 출석과 부분 출석을 참여로 셈 · 휴강·미입력 제외`;
  return (
    <div className="space-y-6">
      {trend.length > 1 ? (
        <Figure title="월별 참여 추이 (연인원)" note={`${note} · 막대 아래는 그 달 실인원`}>
          <MonthlyBars rows={trend} />
        </Figure>
      ) : null}
      <Figure title="수업별 참여 현황" note={note}>
        <HorizontalBars
          rows={byCourse.map((row) => ({
            key: row.courseId,
            label: row.courseName,
            value: row.attendanceCount,
            text: `${row.attendanceCount}회 · ${row.uniqueParticipants}명`,
          }))}
          axisLabel="연인원(회)"
        />
      </Figure>
      {byGender.length > 0 || byDisability.length > 0 || byAgeBand.length > 0 ? (
        <Figure title="참여자 구성 (실인원)" note={note}>
          {byGender.length > 0 || byDisability.length > 0 ? (
            <ShareBars
              rows={[
                { title: '성별', parts: byGender },
                { title: '장애 유무', parts: byDisability },
              ].filter((row) => row.parts.length > 0)}
            />
          ) : null}
          {byAgeBand.length > 0 ? (
            <div className="mt-4">
              <HorizontalBars
                rows={byAgeBand.map((row) => ({
                  key: row.key,
                  label: row.label,
                  value: row.uniqueParticipants,
                  text: `${row.uniqueParticipants}명`,
                }))}
                axisLabel="연령대별 실인원(명)"
              />
            </div>
          ) : null}
        </Figure>
      ) : null}
    </div>
  );
}

function Figure({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <figure className="break-inside-avoid-page">
      <figcaption className="mb-2 text-[12pt] font-semibold" style={{ color: INK }}>
        {title}
      </figcaption>
      {children}
      <p className="mt-1 text-[8.5pt]" style={{ color: MUTED }}>
        {note}
      </p>
    </figure>
  );
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => value / s <= 5) ?? magnitude * 10;
  return Math.ceil(value / step) * step;
}

// 아래쪽 모서리는 각지고 위쪽만 둥근 막대 (기준선에 붙는 쪽은 평평하게)
function topRoundedBar(x: number, y: number, width: number, height: number, radius = 4): string {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

function rightRoundedBar(x: number, y: number, width: number, height: number, radius = 4): string {
  const r = Math.min(radius, height / 2, width);
  return `M${x},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} H${x} Z`;
}

function MonthlyBars({ rows }: { rows: MonthlyTrendRow[] }) {
  const height = 250;
  const margin = { top: 24, right: 12, bottom: 48, left: 44 };
  const plotW = WIDTH - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const max = niceMax(Math.max(...rows.map((row) => row.attendanceCount)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const slot = plotW / rows.length;
  const barW = Math.min(48, slot * 0.6);
  const y = (value: number) => margin.top + plotH - (value / max) * plotH;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" role="img" aria-label="월별 연인원 막대 그래프">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={margin.left} x2={WIDTH - margin.right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
          <text x={margin.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={10} fill={MUTED}>
            {tick}
          </text>
        </g>
      ))}
      <text x={margin.left} y={12} fontSize={10} fill={MUTED}>
        연인원(회)
      </text>
      {rows.map((row, index) => {
        const cx = margin.left + slot * index + slot / 2;
        const top = y(row.attendanceCount);
        return (
          <g key={row.month}>
            {row.attendanceCount > 0 ? (
              <path d={topRoundedBar(cx - barW / 2, top, barW, margin.top + plotH - top)} fill={PRIMARY} />
            ) : null}
            <text x={cx} y={top - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK}>
              {row.attendanceCount}회
            </text>
            <text x={cx} y={margin.top + plotH + 16} textAnchor="middle" fontSize={11} fill={INK}>
              {Number(row.month.slice(5))}월
            </text>
            <text x={cx} y={margin.top + plotH + 32} textAnchor="middle" fontSize={10} fill={MUTED}>
              {row.uniqueParticipants}명
            </text>
          </g>
        );
      })}
      <line
        x1={margin.left}
        x2={WIDTH - margin.right}
        y1={margin.top + plotH}
        y2={margin.top + plotH}
        stroke={MUTED}
        strokeWidth={1}
      />
    </svg>
  );
}

function HorizontalBars({
  rows,
  axisLabel,
}: {
  rows: Array<{ key: string; label: string; value: number; text: string }>;
  axisLabel: string;
}) {
  const rowH = 26;
  const labelW = 110;
  const textW = 96;
  const top = 18;
  const height = top + rows.length * rowH + 4;
  const plotW = WIDTH - labelW - textW;
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" role="img" aria-label={`${axisLabel} 막대 그래프`}>
      <text x={labelW} y={11} fontSize={10} fill={MUTED}>
        {axisLabel}
      </text>
      {rows.map((row, index) => {
        const y = top + index * rowH;
        const w = (row.value / max) * plotW;
        return (
          <g key={row.key}>
            <text x={labelW - 8} y={y + rowH / 2} dy="0.32em" textAnchor="end" fontSize={11} fill={INK}>
              {row.label}
            </text>
            <rect x={labelW} y={y + 5} width={plotW} height={rowH - 10} fill={GRID} opacity={0.5} />
            {w > 0 ? <path d={rightRoundedBar(labelW, y + 5, w, rowH - 10)} fill={PRIMARY} /> : null}
            <text x={labelW + w + 6} y={y + rowH / 2} dy="0.32em" fontSize={11} fontWeight={600} fill={INK}>
              {row.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ShareBars({ rows }: { rows: Array<{ title: string; parts: ParticipationBreakdownRow[] }> }) {
  const labelW = 110;
  const barW = WIDTH - labelW - 4;
  const rowH = 46;
  const height = rows.length * rowH;
  const colors = [PRIMARY, SECONDARY];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" role="img" aria-label="성별·장애 유무 구성 막대 그래프">
      {rows.map((row, rowIndex) => {
        const total = row.parts.reduce((sum, part) => sum + part.uniqueParticipants, 0);
        const y = rowIndex * rowH;
        let x = labelW;
        return (
          <g key={row.title}>
            <text x={labelW - 8} y={y + 12} dy="0.32em" textAnchor="end" fontSize={11} fill={INK}>
              {row.title}
            </text>
            {row.parts.map((part, partIndex) => {
              const w = total > 0 ? (part.uniqueParticipants / total) * barW : 0;
              const segment = (
                <rect
                  key={part.key}
                  x={x}
                  y={y + 2}
                  width={Math.max(0, w - 2)}
                  height={20}
                  rx={3}
                  fill={part.key === 'unknown' ? UNKNOWN : colors[partIndex % colors.length]}
                />
              );
              x += w;
              return segment;
            })}
            <text x={labelW} y={y + 36} fontSize={10.5} fill={INK}>
              {row.parts.map((part, partIndex) => {
                const share = total > 0 ? Math.round((part.uniqueParticipants / total) * 100) : 0;
                return (
                  <tspan key={part.key} dx={partIndex === 0 ? 0 : 18}>
                    <tspan fill={part.key === 'unknown' ? UNKNOWN : colors[partIndex % colors.length]}>■</tspan>
                    {` ${part.label} ${part.uniqueParticipants}명 (${share}%)`}
                  </tspan>
                );
              })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
