"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { apiHeaders } from "@/lib/api-headers";

type PermGroup = { id: string; group_name: string; description: string | null };
type Dept = { id: string; dept_code: string; dept_name: string };
type AppUser = {
  id: string;
  login_id: string;
  display_name: string | null;
  dept_id: string | null;
  dept_name: string | null;
  group_id: string;
  group_name: string | null;
  created_at: string | null;
  last_login_at: string | null;
};

function isBuiltinAdminLogin(loginId: string) {
  return loginId.trim().toLowerCase() === "admin";
}

function fmt(dt: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("ko-KR");
  } catch {
    return dt;
  }
}

export default function AdminUsersPage() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api", []);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [groups, setGroups] = useState<PermGroup[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    login_id: "",
    password: "",
    display_name: "",
    dept_id: "",
    group_id: "",
  });

  const load = useCallback(async () => {
    const h = apiHeaders();
    const [ur, gr, dr] = await Promise.all([
      fetch(`${apiBase}/v1/admin/users`, { headers: h }),
      fetch(`${apiBase}/v1/admin/perm-groups`, { headers: h }),
      fetch(`${apiBase}/v1/admin/departments`, { headers: h }),
    ]);
    if (!ur.ok) throw new Error(await ur.text());
    if (!gr.ok) throw new Error(await gr.text());
    if (!dr.ok) throw new Error(await dr.text());
    setUsers((await ur.json()) as AppUser[]);
    setGroups((await gr.json()) as PermGroup[]);
    setDepts((await dr.json()) as Dept[]);
  }, [apiBase]);

  useEffect(() => {
    void load().catch((e) => setNotice(e instanceof Error ? e.message : "목록 조회 실패"));
  }, [load]);

  const openCreate = () => {
    setNotice("");
    setForm({
      login_id: "",
      password: "",
      display_name: "",
      dept_id: depts[0]?.id ?? "",
      group_id: groups[0]?.id ?? "",
    });
    setModal("create");
  };

  const openEdit = (u: AppUser) => {
    setNotice("");
    setEditId(u.id);
    setForm({
      login_id: u.login_id,
      password: "",
      display_name: u.display_name ?? "",
      dept_id: u.dept_id ?? depts[0]?.id ?? "",
      group_id: u.group_id,
    });
    setModal("edit");
  };

  const submitCreate = async () => {
    setNotice("");
    try {
      const resp = await fetch(`${apiBase}/v1/admin/users`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          login_id: form.login_id,
          password: form.password,
          display_name: form.display_name.trim() || null,
          dept_id: form.dept_id,
          group_id: form.group_id,
        }),
      });
      if (!resp.ok) {
        setNotice(await resp.text());
        return;
      }
      setModal(null);
      await load();
      setNotice("사용자가 등록되었습니다.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "등록 실패");
    }
  };

  const submitEdit = async () => {
    if (!editId) return;
    setNotice("");
    try {
      const body: Record<string, unknown> = {
        display_name: form.display_name.trim() || null,
        dept_id: form.dept_id,
      };
      if (!isBuiltinAdminLogin(form.login_id)) {
        body.group_id = form.group_id;
      }
      if (form.password.length >= 6) body.password = form.password;
      const resp = await fetch(`${apiBase}/v1/admin/users/${editId}`, {
        method: "PUT",
        headers: apiHeaders(),
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        setNotice(await resp.text());
        return;
      }
      setModal(null);
      setEditId(null);
      await load();
      setNotice("사용자 정보가 저장되었습니다.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "저장 실패");
    }
  };

  const removeUser = async (u: AppUser) => {
    if (!window.confirm(`${u.login_id} 계정을 삭제(비활성화)할까요?`)) return;
    setNotice("");
    try {
      const resp = await fetch(`${apiBase}/v1/admin/users/${u.id}`, {
        method: "DELETE",
        headers: apiHeaders(),
      });
      if (!resp.ok) {
        setNotice(await resp.text());
        return;
      }
      await load();
      setNotice("사용자가 삭제(비활성화)되었습니다.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">사용자</h1>
          <p className="mt-1 text-sm text-slate-600">
            <strong>ID</strong>·이름·부서·권한 그룹·생성일·마지막 접속을 관리합니다. 부서 코드는{" "}
            <Link href="/admin/departments" className="text-indigo-600 hover:underline">
              부서 관리
            </Link>
            에서 추가합니다. 시드 계정 <code className="rounded bg-slate-100 px-1">admin</code> /{" "}
            <code className="rounded bg-slate-100 px-1">admin123</code> —{" "}
            <code className="rounded bg-slate-100 px-1">admin</code> 은 권한 그룹 변경·삭제가 제한됩니다.
          </p>
        </div>
        <Button type="button" onClick={openCreate} disabled={!groups.length || !depts.length}>
          사용자 추가
        </Button>
      </div>
      {notice ? <p className="text-xs text-amber-700">{notice}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-slate-200 bg-slate-100">
              <th
                scope="col"
                className="border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                ID
              </th>
              <th
                scope="col"
                className="border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                이름
              </th>
              <th
                scope="col"
                className="border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                부서
              </th>
              <th
                scope="col"
                className="border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                권한 그룹
              </th>
              <th
                scope="col"
                className="border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                생성일
              </th>
              <th
                scope="col"
                className="border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                마지막 접속
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/60">
                <td className="border-r border-slate-100 bg-slate-50/50 px-4 py-3 align-middle">
                  <span className="inline-block rounded bg-white px-2 py-1 font-mono text-xs font-medium text-slate-800 ring-1 ring-slate-200/80">
                    {u.login_id}
                  </span>
                </td>
                <td className="border-r border-slate-100 px-4 py-3 align-middle text-slate-900">
                  <span className="block truncate" title={u.display_name ?? undefined}>
                    {u.display_name?.trim() ? u.display_name : "—"}
                  </span>
                </td>
                <td className="border-r border-slate-100 px-4 py-3 align-middle text-slate-900">
                  <span className="block truncate" title={u.dept_name ?? undefined}>
                    {u.dept_name ?? "—"}
                  </span>
                </td>
                <td className="border-r border-slate-100 px-4 py-3 align-middle text-slate-900">
                  <span className="block truncate" title={u.group_name ?? u.group_id}>
                    {u.group_name ?? u.group_id}
                  </span>
                </td>
                <td className="border-r border-slate-100 px-4 py-3 align-middle text-xs text-slate-600">{fmt(u.created_at)}</td>
                <td className="border-r border-slate-100 px-4 py-3 align-middle text-xs text-slate-600">{fmt(u.last_login_at)}</td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant="success"
                      size="xs"
                      className="shrink-0 whitespace-nowrap"
                      onClick={() => openEdit(u)}
                    >
                      수정
                    </Button>
                    {isBuiltinAdminLogin(u.login_id) ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        className="shrink-0 whitespace-nowrap opacity-40"
                        disabled
                        title="기본 admin 계정은 삭제할 수 없습니다."
                      >
                        삭제
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        className="shrink-0 whitespace-nowrap"
                        onClick={() => removeUser(u)}
                      >
                        삭제
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <h2 className="text-lg font-semibold">{modal === "create" ? "사용자 추가" : "사용자 수정"}</h2>
            <div className="mt-3 space-y-2">
              {modal === "create" ? (
                <label className="block text-xs">
                  <span className="text-slate-600">로그인 ID</span>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={form.login_id}
                    onChange={(e) => setForm((f) => ({ ...f, login_id: e.target.value }))}
                  />
                </label>
              ) : (
                <p className="text-xs text-slate-500">
                  로그인 ID: <span className="font-mono">{form.login_id}</span>
                </p>
              )}
              <label className="block text-xs">
                <span className="text-slate-600">{modal === "create" ? "비밀번호" : "비밀번호(변경 시만)"}</span>
                <input
                  type="password"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={modal === "edit" ? "6자 이상 입력 시 변경" : ""}
                />
              </label>
              <label className="block text-xs">
                <span className="text-slate-600">이름</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="표시용 이름(선택)"
                />
              </label>
              <label className="block text-xs">
                <span className="text-slate-600">부서</span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.dept_id}
                  onChange={(e) => setForm((f) => ({ ...f, dept_id: e.target.value }))}
                >
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.dept_name} ({d.dept_code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-slate-600">권한 그룹</span>
                {modal === "edit" && isBuiltinAdminLogin(form.login_id) ? (
                  <p className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {groups.find((g) => g.id === form.group_id)?.group_name ?? form.group_id}
                    <span className="mt-1 block text-[11px] font-normal text-slate-500">
                      기본 admin 계정은 시스템관리자 권한에서만 유지됩니다.
                    </span>
                  </p>
                ) : (
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={form.group_id}
                    onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value }))}
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.group_name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModal(null)}>
                취소
              </Button>
              <Button type="button" variant="success" size="sm" onClick={modal === "create" ? submitCreate : submitEdit}>
                저장
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
