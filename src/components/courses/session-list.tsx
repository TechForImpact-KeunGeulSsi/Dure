'use client';

import { MoreHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { CourseSessionSummary } from '@/types/course';
import {
  SESSION_PROGRESS_LABEL,
  SESSION_ROLLUP_LABEL,
  SESSION_TYPE_LABEL,
  SESSION_VISIBILITY_LABEL,
} from '@/types/course';

type SessionListProps = {
  initialSessions: CourseSessionSummary[];
};

function formatDate(date: string) {
  return date.replaceAll('-', '.');
}

function formatTimeRange(startsAt: string, endsAt: string) {
  return `${startsAt.slice(0, 5)} - ${endsAt.slice(0, 5)}`;
}

export function SessionList({ initialSessions }: SessionListProps) {
  const [sessions, setSessions] = useState(initialSessions);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.sessionNo - b.sessionNo),
    [sessions],
  );

  const updateSession = (
    sessionId: string,
    patch: Partial<
      Pick<CourseSessionSummary, 'visibilityStatus' | 'rollupStatus' | 'progressStatus' | 'type'>
    >,
  ) => {
    setSessions((prev) =>
      prev.map((session) => (session.id === sessionId ? { ...session, ...patch } : session)),
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">회차 목록</h2>
        <p className="mt-0.5 text-sm text-gray-500">노출·집계·진행 상태를 관리합니다.</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>번호</TableHead>
            <TableHead>날짜</TableHead>
            <TableHead>시간</TableHead>
            <TableHead>유형</TableHead>
            <TableHead>노출 상태</TableHead>
            <TableHead>기록 집계</TableHead>
            <TableHead>진행 상태</TableHead>
            <TableHead className="text-right">액션</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell className="font-medium text-gray-900">{session.sessionNo}</TableCell>
              <TableCell>{formatDate(session.date)}</TableCell>
              <TableCell>{formatTimeRange(session.startsAt, session.endsAt)}</TableCell>
              <TableCell>
                <Select
                  value={session.type}
                  onChange={(event) =>
                    updateSession(session.id, {
                      type: event.target.value as CourseSessionSummary['type'],
                    })
                  }
                  className="min-w-[88px]"
                >
                  {Object.entries(SESSION_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={session.visibilityStatus === 'visible'}
                    onCheckedChange={(checked) =>
                      updateSession(session.id, {
                        visibilityStatus: checked ? 'visible' : 'hidden',
                      })
                    }
                    aria-label="visibility"
                  />
                  <span className="text-xs text-gray-500">
                    {SESSION_VISIBILITY_LABEL[session.visibilityStatus]}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={session.rollupStatus === 'included'}
                    onCheckedChange={(checked) =>
                      updateSession(session.id, {
                        rollupStatus: checked ? 'included' : 'excluded',
                      })
                    }
                    aria-label="rollup"
                  />
                  <span className="text-xs text-gray-500">
                    {SESSION_ROLLUP_LABEL[session.rollupStatus]}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={session.progressStatus}
                  disabled={session.progressStatus === 'cancelled'}
                  onChange={(event) =>
                    updateSession(session.id, {
                      progressStatus: event.target.value as CourseSessionSummary['progressStatus'],
                    })
                  }
                  className={cn(
                    'min-w-[88px]',
                    session.progressStatus === 'cancelled' && 'text-red-600',
                  )}
                >
                  {Object.entries(SESSION_PROGRESS_LABEL).map(([value, label]) => (
                    <option
                      key={value}
                      value={value}
                      className={cn(value === 'cancelled' ? 'text-red-600' : 'text-gray-900')}
                    >
                      {label}
                    </option>
                  ))}
                </Select>
                {session.progressStatus === 'cancelled' && session.cancellationReason && (
                  <p className="mt-1 max-w-xs text-xs text-rose-700">
                    {session.cancellationReason}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button type="button" variant="ghost" size="icon" aria-label="actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
