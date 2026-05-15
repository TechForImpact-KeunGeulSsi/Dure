'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BookOpen,
  Calendar,
  LayoutGrid,
  Menu,
  Search,
  Settings,
  UserCog,
  Users,
} from 'lucide-react';
import { useState, type ComponentType, type ReactNode } from 'react';

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

const DEFAULT_WORKSPACE_ID = 'ws-demo-001';

const primaryNav: NavItem[] = [
  { label: '홈', href: `/workspaces/${DEFAULT_WORKSPACE_ID}/home`, icon: LayoutGrid },
  { label: '일정 관리', href: `/workspaces/${DEFAULT_WORKSPACE_ID}/calendar`, icon: Calendar },
  { label: '권한 설정', href: '/permissions', icon: UserCog },
];

const manageNav: NavItem[] = [
  { label: '그룹 관리', href: '/manage/groups', icon: Settings },
  { label: '수업 관리', href: '/manage/courses', icon: BookOpen },
  { label: '참여자 관리', href: '/manage/participants', icon: Users },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isHomeNav = item.label === '홈';
  const isActive =
    pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(item.href)) ||
    (isHomeNav &&
      pathname.startsWith('/workspaces/') &&
      pathname.includes('/courses/'));
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-r-xl px-4 py-2.5 text-sm font-medium transition ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8FE]">
      {/* Sidebar */}
      <aside
        className={`flex flex-shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-200 ${
          sidebarOpen ? 'w-56' : 'w-0 overflow-hidden border-r-0'
        }`}
      >
        <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
          {primaryNav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          <div className="my-3 border-t border-gray-100" />

          {manageNav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 flex-shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="메뉴 열기"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" className="text-lg font-bold text-blue-600">
            Dure
          </Link>

          <div className="mx-auto hidden max-w-xl flex-1 sm:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="수업 검색"
                className="w-full rounded-lg bg-gray-100 py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="알림"
            >
              <Bell className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-800"
              aria-label="프로필"
            >
              A
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
