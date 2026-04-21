"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/reports", label: "보고서" },
  { href: "/outputs", label: "산출조회" },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            ReportBank
          </Link>
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100",
                    active && "bg-neutral-900 text-white hover:bg-neutral-800"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="text-sm text-neutral-600">
          접속자: <span className="font-medium text-neutral-900">admin</span>
        </div>
      </div>
    </header>
  );
}
