"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  FolderSearch2,
  Home,
  ShieldCheck,
  ShieldCog,
  Table2,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon };

const items: Item[] = [
  { href: "/dashboard", label: "대시보드 홈", icon: Home },
  { href: "/outputs", label: "PSR 산출", icon: FileText },
  { href: "/approvals", label: "승인 관리함", icon: ShieldCheck },
  { href: "/metadata", label: "메타데이터 탐색기", icon: FolderSearch2 },
  { href: "/reports", label: "팀별 레포트", icon: Table2 },
  { href: "/security", label: "보안 설정", icon: ShieldCog },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
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
      <nav className="space-y-1 p-2">
        {items.map((item) => {
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
      </nav>
    </aside>
  );
}
