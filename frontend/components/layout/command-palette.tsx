"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { canShowAdminPageKey } from "@/lib/menu-access";

const quickLinksBase = [
  { href: "/dashboard", label: "대시보드 홈" },
  { href: "/outputs", label: "PSR 산출" },
  { href: "/approvals", label: "승인 관리함" },
  { href: "/infosec/masking-policy", label: "마스킹 정책" },
  { href: "/security", label: "보안 설정" },
];

export function CommandPalette() {
  const { profile } = useAuth();
  const quickLinks = useMemo(() => {
    const adminPool = [
      { pageKey: "admin_users" as const, href: "/admin/users", label: "사용자 (관리자)" },
      { pageKey: "admin_departments" as const, href: "/admin/departments", label: "부서 관리" },
      { pageKey: "admin_permissions" as const, href: "/admin/permissions", label: "권한 관리" },
    ];
    const admin = adminPool
      .filter((x) => canShowAdminPageKey(profile, x.pageKey))
      .map(({ pageKey: _p, ...rest }) => rest);
    return [...quickLinksBase, ...admin];
  }, [profile]);

  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-sm text-slate-500"
        onClick={() => setOpen(true)}
      >
        검색... <span className="float-right text-xs">Ctrl+K</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="mx-auto mt-20 w-full max-w-xl rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-xs text-slate-500">빠른 이동</p>
            <div className="space-y-1">
              {quickLinks.map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="block rounded-md px-3 py-2 text-sm hover:bg-slate-100"
                  onClick={() => setOpen(false)}
                >
                  {q.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
