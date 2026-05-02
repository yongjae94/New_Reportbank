"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Database,
  FileText,
  Home,
  FlaskConical,
  KeyRound,
  PlayCircle,
  ShieldCheck,
  ShieldCog,
  Table2,
  Users,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { canShowAdminPageKey, canShowDbaPageKey } from "@/lib/menu-access";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon };
type NavItem = Item & { pageKey: string };

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { profile } = useAuth();

  const adminNavPool: NavItem[] = [
    { pageKey: "admin_security_settings", href: "/security", label: "보안 설정", icon: ShieldCog },
    { pageKey: "admin_users", href: "/admin/users", label: "사용자", icon: Users },
    { pageKey: "admin_departments", href: "/admin/departments", label: "부서 관리", icon: Building2 },
    { pageKey: "admin_permissions", href: "/admin/permissions", label: "권한 관리", icon: KeyRound },
  ];
  const adminItems: Item[] = adminNavPool
    .filter((row) => canShowAdminPageKey(profile, row.pageKey))
    .map(({ pageKey: _pk, ...rest }) => rest);

  const baseSections: Array<{ title: string; items: Item[] }> = [
    {
      title: "공통",
      items: [
        { href: "/dashboard", label: "대시보드 홈", icon: Home },
        { href: "/outputs", label: "PSR 산출", icon: FileText },
        { href: "/reports", label: "팀별 레포트", icon: Table2 },
      ],
    },
    {
      title: "정보보호담당자",
      items: [
        { href: "/approvals", label: "승인 관리함", icon: ShieldCheck },
        { href: "/infosec/masking-policy", label: "마스킹 정책", icon: ShieldCog },
      ],
    },
    ...(adminItems.length ? [{ title: "관리자", items: adminItems }] : []),
  ];

  const dbaExclusivePool: NavItem[] = [
    { pageKey: "dba_approvals", href: "/dba/approvals", label: "DBA 승인함", icon: PlayCircle },
    { pageKey: "dba_db_connections", href: "/dba/db-connections", label: "DB Connection 관리", icon: Database },
  ];
  const dbaTestPool: NavItem[] = [
    { pageKey: "dba_test_input", href: "/dba/test-input", label: "테스트 입력 페이지", icon: FlaskConical },
  ];
  const dbaExclusiveItems: Item[] = dbaExclusivePool
    .filter((row) => canShowDbaPageKey(profile, row.pageKey))
    .map(({ pageKey: _pk, ...rest }) => rest);
  const dbaTestItems: Item[] = dbaTestPool
    .filter((row) => canShowDbaPageKey(profile, row.pageKey))
    .map(({ pageKey: _pk, ...rest }) => rest);

  const sections: Array<{ title: string; items: Item[] }> = [...baseSections];
  if (dbaExclusiveItems.length) {
    sections.push({ title: "DBA 전용", items: dbaExclusiveItems });
  }
  if (dbaTestItems.length) {
    sections.push({ title: "테스트", items: dbaTestItems });
  }

  return (
    <aside
      className={cn(
        "border-r border-slate-200 bg-slate-950 text-slate-100 transition-all",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-slate-800 px-3">
        {!collapsed ? <Link href="/" className="font-semibold text-indigo-300">ReportBank</Link> : null}
        <button
          className="rounded-md p-2 text-slate-300 hover:bg-slate-800"
          onClick={onToggle}
          aria-label="toggle sidebar"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <nav className="space-y-4 p-2">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed ? (
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-slate-500">{section.title}</p>
            ) : null}
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white",
                    active && "bg-indigo-600 text-white hover:bg-indigo-500"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
