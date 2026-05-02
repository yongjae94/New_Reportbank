"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { canShowAdminPageKey } from "@/lib/menu-access";

export default function SecuritySettingsPage() {
  const { profile } = useAuth();
  const showUsers = canShowAdminPageKey(profile, "admin_users");
  const showDepts = canShowAdminPageKey(profile, "admin_departments");
  const showPerms = canShowAdminPageKey(profile, "admin_permissions");
  const canAdmin = showUsers || showDepts || showPerms;
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">보안 설정</h1>
        <p className="mt-1 text-sm text-slate-600">관리자가 시스템 접속 권한과 역할 기반 접근(RBAC)을 관리합니다.</p>
      </div>
      {canAdmin ? (
        <div className="flex flex-wrap gap-3 text-sm">
          {showUsers ? (
            <Link href="/admin/users" className="text-indigo-600 hover:underline">
              사용자 관리 →
            </Link>
          ) : null}
          {showDepts ? (
            <Link href="/admin/departments" className="text-indigo-600 hover:underline">
              부서 관리 →
            </Link>
          ) : null}
          {showPerms ? (
            <Link href="/admin/permissions" className="text-indigo-600 hover:underline">
              권한 그룹·메뉴별 권한 →
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium">사용자 권한 관리</h3>
          <p className="mt-1 text-xs text-slate-500">
            팀별 사용자 등록, 역할 부여(DBA/정보보호담당자/요청자), 메뉴 접근 권한을 관리합니다.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium">접속 정책</h3>
          <p className="mt-1 text-xs text-slate-500">
            시스템 로그인 허용 대상, 계정 잠금/해제, 접속 가능 시간대 등 운영 정책을 관리합니다.
          </p>
        </div>
      </div>
    </section>
  );
}
