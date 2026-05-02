"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiHeaders } from "@/lib/api-headers";

type Dept = { id: string; dept_code: string; dept_name: string };

export default function AdminDepartmentsPage() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api", []);
  const [rows, setRows] = useState<Dept[]>([]);
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    const resp = await fetch(`${apiBase}/v1/admin/departments`, { headers: apiHeaders() });
    if (!resp.ok) throw new Error(await resp.text());
    setRows((await resp.json()) as Dept[]);
  }, [apiBase]);

  useEffect(() => {
    void load().catch((e) => setNotice(e instanceof Error ? e.message : "조회 실패"));
  }, [load]);

  const createDept = async () => {
    setNotice("");
    try {
      const resp = await fetch(`${apiBase}/v1/admin/departments`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ dept_code: code.trim().toLowerCase(), dept_name: name.trim() }),
      });
      if (!resp.ok) {
        setNotice(await resp.text());
        return;
      }
      setCode("");
      setName("");
      await load();
      setNotice("부서가 등록되었습니다. (코드는 변경할 수 없습니다)");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "등록 실패");
    }
  };

  const startRename = (d: Dept) => {
    setEditId(d.id);
    setEditName(d.dept_name);
    setNotice("");
  };

  const removeDept = async (d: Dept) => {
    if (
      !window.confirm(
        `부서 "${d.dept_name}" (${d.dept_code})를 삭제할까요?\n연결된 활성 사용자가 있으면 삭제되지 않습니다.`
      )
    ) {
      return;
    }
    setNotice("");
    try {
      const resp = await fetch(`${apiBase}/v1/admin/departments/${d.id}`, {
        method: "DELETE",
        headers: apiHeaders(),
      });
      const errText = await resp.text();
      if (!resp.ok) {
        try {
          const j = JSON.parse(errText) as { detail?: unknown };
          const detail = j.detail;
          setNotice(typeof detail === "string" ? detail : errText);
        } catch {
          setNotice(errText);
        }
        return;
      }
      if (editId === d.id) setEditId(null);
      await load();
      setNotice("부서가 삭제되었습니다.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const saveRename = async () => {
    if (!editId) return;
    setNotice("");
    try {
      const resp = await fetch(`${apiBase}/v1/admin/departments/${editId}`, {
        method: "PATCH",
        headers: apiHeaders(),
        body: JSON.stringify({ dept_name: editName.trim() }),
      });
      if (!resp.ok) {
        setNotice(await resp.text());
        return;
      }
      setEditId(null);
      await load();
      setNotice("부서명이 저장되었습니다.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "저장 실패");
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">부서 관리</h1>
        <p className="mt-1 text-sm text-slate-600">
          <code className="rounded bg-slate-100 px-1">dept_code</code>는 증빙·Casbin 스코프용 안정 키(소문자·밑줄)이며, 개편 시에는{" "}
          <strong>부서명</strong>만 수정하면 됩니다. 삭제는 해당 부서에{" "}
          <strong>활성 사용자가 없을 때만</strong> 가능하며, 삭제 후 같은 코드로 다시 등록할 수 있습니다.
        </p>
      </div>
      {notice ? <p className="text-xs text-amber-700">{notice}</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-medium">부서 추가</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="min-w-[120px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
            placeholder="코드 예: ops_fin"
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          />
          <input
            className="min-w-[160px] flex-[2] rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="부서명"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="button" onClick={createDept} disabled={!code.trim() || !name.trim()}>
            등록
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[26%]" />
            <col className="w-[44%]" />
            <col className="w-[30%]" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-slate-200 bg-slate-100">
              <th
                scope="col"
                className="border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                코드
              </th>
              <th
                scope="col"
                className="border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                부서명
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50/60">
                <td className="border-r border-slate-100 bg-slate-50/50 px-4 py-3 align-middle font-mono text-xs text-slate-800">
                  <span className="inline-block rounded bg-white px-2 py-1 font-medium ring-1 ring-slate-200/80">
                    {d.dept_code}
                  </span>
                </td>
                <td className="border-r border-slate-100 px-4 py-3 align-middle text-slate-900">
                  {editId === d.id ? (
                    <input
                      className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label="부서명 편집"
                    />
                  ) : (
                    <span className="block truncate" title={d.dept_name}>
                      {d.dept_name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  {editId === d.id ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="success"
                        size="xs"
                        className="shrink-0 whitespace-nowrap"
                        onClick={saveRename}
                        disabled={!editName.trim()}
                      >
                        저장
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="shrink-0 whitespace-nowrap"
                        onClick={() => setEditId(null)}
                      >
                        취소
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="success"
                        size="xs"
                        className="shrink-0 whitespace-nowrap"
                        onClick={() => startRename(d)}
                      >
                        수정
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        className="shrink-0 whitespace-nowrap"
                        onClick={() => removeDept(d)}
                      >
                        삭제
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
