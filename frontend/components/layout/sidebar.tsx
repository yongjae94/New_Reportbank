"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  FileText,
  Home,
  PlayCircle,
  ShieldCheck,
  ShieldCog,
  Table2,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CURRENT_USER } from "@/lib/report-templates";

type Item = { href: string; label: string; icon: LucideIcon };

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
    items: [{ href: "/approvals", label: "승인 관리함", icon: ShieldCheck }],
  },
  {
    title: "관리자",
    items: [{ href: "/security", label: "보안 설정", icon: ShieldCog }],
  },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const sections =
    CURRENT_USER.role === "DBA"
      ? [
          ...baseSections,
          {
            title: "DBA 전용",
            items: [
              { href: "/dba/approvals", label: "DBA 승인함", icon: PlayCircle },
              { href: "/dba/db-connections", label: "DB Connection 관리", icon: Database },
            ],
          },
        ]
      : baseSections;
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
