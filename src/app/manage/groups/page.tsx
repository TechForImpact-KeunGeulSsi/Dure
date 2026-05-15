'use client';

import React, { useMemo, useState } from 'react';

// ── Types (getGroupsPage API) ─────────────────────────────────────────────────

type UUID = string;
type GroupStatus = 'active' | 'inactive';

interface GroupSummary {
  id: UUID;
  name: string;
  description: string | null;
  status: GroupStatus;
}

interface GroupListItem extends GroupSummary {
  participantCount: number;
  courseCount: number;
  canEditDescription: boolean;
  canManageLifecycle: boolean;
}

interface GetGroupsPageOutput {
  groups: GroupListItem[];
  pageInfo: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_GROUPS: GroupListItem[] = [
  {
    id: '1',
    name: '햇살 그룹',
    description: '청도 권역',
    status: 'active',
    participantCount: 126,
    courseCount: 8,
    canEditDescription: true,
    canManageLifecycle: true,
  },
  {
    id: '2',
    name: '바람 그룹',
    description: '서울 권역',
    status: 'active',
    participantCount: 84,
    courseCount: 5,
    canEditDescription: true,
    canManageLifecycle: true,
  },
  {
    id: '3',
    name: '옛역 그룹',
    description: '부산 권역',
    status: 'inactive',
    participantCount: 42,
    courseCount: 2,
    canEditDescription: false,
    canManageLifecycle: true,
  },
  {
    id: '4',
    name: '별빛 그룹',
    description: '대구 권역',
    status: 'active',
    participantCount: 67,
    courseCount: 4,
    canEditDescription: true,
    canManageLifecycle: false,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: GroupStatus }) {
  const isActive = status === 'active';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
      }`}
    >
      {isActive ? '활성' : '비활성'}
    </span>
  );
}

function GroupCardIcon() {
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
      <svg
        className="h-4 w-4 text-blue-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GroupManagementPage() {
  const [groupName, setGroupName] = useState('');
  const [region, setRegion] = useState('');
  const [formStatus, setFormStatus] = useState<GroupStatus>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MOCK_GROUPS;
    return MOCK_GROUPS.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description?.toLowerCase().includes(q) ?? false),
    );
  }, [searchQuery]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="mb-1 text-2xl font-bold text-gray-900">그룹 관리</h1>
          <p className="text-sm text-gray-500">
            그룹, 수업, 참여자 운영 단위를 관리합니다.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex space-x-6 border-b border-gray-200">
          <button
            type="button"
            className="border-b-2 border-blue-600 pb-3 text-sm font-semibold text-blue-600"
          >
            그룹 관리
          </button>
          <button
            type="button"
            className="pb-3 text-sm font-medium text-gray-400 hover:text-gray-600"
          >
            수업 관리
          </button>
          <button
            type="button"
            className="pb-3 text-sm font-medium text-gray-400 hover:text-gray-600"
          >
            참여자 관리
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Add Group Form */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">그룹 추가</h2>
              <p className="mt-1 text-sm text-gray-400">새 운영 단위를 등록합니다.</p>

              <form
                className="mt-6 space-y-5"
                onSubmit={(e) => e.preventDefault()}
              >
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    그룹 이름
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="예: 햇살 그룹"
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    지역
                  </label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="지역 선택"
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    상태
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormStatus('active')}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                        formStatus === 'active'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      활성
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormStatus('inactive')}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                        formStatus === 'inactive'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      비활성
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="mt-1 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800"
                >
                  그룹 생성
                </button>
              </form>
            </div>
          </div>

          {/* Right: Group List */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">등록된 그룹</h2>
                  <p className="mt-0.5 text-sm text-gray-400">
                    등록된 그룹 {MOCK_GROUPS.length}개
                  </p>
                </div>
                <div className="relative w-full sm:w-52">
                  <svg
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="그룹 검색..."
                    className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredGroups.map((group) => (
                  <div
                    key={group.id}
                    className="flex cursor-pointer flex-col justify-between rounded-xl border border-gray-100 p-5 transition hover:border-blue-200 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <GroupCardIcon />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-bold text-gray-900">
                          {group.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {group.description ?? '지역 미지정'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-gray-50 pt-4">
                      <span className="text-xs text-gray-500">
                        참여자 {group.participantCount.toLocaleString()}명
                      </span>
                      <StatusBadge status={group.status} />
                    </div>
                  </div>
                ))}
              </div>

              {filteredGroups.length === 0 && (
                <p className="py-12 text-center text-sm text-gray-400">
                  검색 결과가 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
