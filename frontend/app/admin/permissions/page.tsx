"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiHeaders } from "@/lib/api-headers";

type PermGroup = { id: string; group_name: string; description: string | null };
type MatrixRow = { page_key: string; label: string; can_read: "Y" | "N"; can_write: "Y" | "N" };

export default function AdminPermissionsPage() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api", []);
  const [groups, setGroups] = useState<PermGroup[]>([]);
  const [groupId, setGroupId] = useState("");
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [notice, setNotice] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");

  const loadGroups = useCallback(async () => {
    const resp = await fetch(`${apiBase}/v1/admin/perm-groups`, { headers: apiHeaders() });
    if (!resp.ok) throw new Error(await resp.text());
    const list = (await resp.json()) as PermGroup[];
    setGroups(list);
    return list;
  }, [apiBase]);

  const loadMatrix = useCallback(
    async (gid: string) => {
      if (!gid) {
        setMatrix([]);
        return;
      }
      const resp = await fetch(`${apiBase}/v1/admin/perm-groups/${gid}/matrix`, {
        headers: apiHeaders(),
      });
      if (!resp.ok) throw new Error(await resp.text());
      setMatrix((await resp.json()) as MatrixRow[]);
    },
    [apiBase]
  );

  useEffect(() => {
    void loadGroups()
      .then((list) => {
        setGroupId((prev) => prev || (list[0]?.id ?? ""));
      })
      .catch((e) => setNotice(e instanceof Error ? e.message : "그룹 조회 실패"));
  }, [loadGroups]);

  useEffect(() => {
    if (!groupId) return;
    void loadMatrix(groupId).catch((e) => setNotice(e instanceof Error ? e.message : "매트릭스 조회 실패"));
  }, [groupId, loadMatrix]);

  const setRead = (idx: number, v: boolean) => {
    setMatrix((prev) => {
      const next = [...prev];
      const row = { ...next[idx] };
      row.can_read = v ? "Y" : "N";
      if (!v && row.can_write === "Y") row.can_write = "N";
      next[idx] = row;
      return next;
    });
  };

  const setWrite = (idx: number, v: boolean) => {
    setMatrix((prev) => {
      const next = [...prev];
      const row = { ...next[idx] };
      row.can_write = v ? "Y" : "N";
      if (v) row.can_read = "Y";
      next[idx] = row;
      return next;
    });
  };

  const saveMatrix = async () => {
    setNotice("");
    try {
      const resp = await fetch(`${apiBase}/v1/admin/perm-groups/${groupId}/matrix`, {
        method: "PUT",
        headers: apiHeaders(),
        body: JSON.stringify({
          rows: matrix.map((m) => ({
            page_key: m.page_key,
            can_read: m.can_read,
            can_write: m.can_write,
          })),
        }),
      });
      if (!resp.ok) {
        setNotice(await resp.text());
        return;
      }
      setNotice("권한이 저장되었습니다.");
      await loadMatrix(groupId);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "저장 실패");
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setNotice("");
    try {
      const resp = await fetch(`${apiBase}/v1/admin/perm-groups`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ group_name: newGroupName.trim(), description: newGroupDesc.trim() || null }),
      });
      if (!resp.ok) {
        setNotice(await resp.text());
        return;
      }
      const g = (await resp.json()) as PermGroup;
      setNewGroupName("");
      setNewGroupDesc("");
      await loadGroups();
      setGroupId(g.id);
      setNotice("권한 그룹이 생성되었습니다.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "생성 실패");
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">권한 관리</h1>
        <p className="mt-1 text-sm text-slate-600">
          권한 그룹별로 메뉴(페이지) 단위 <strong>조회</strong>와 <strong>수정</strong>을 설정합니다. 수정 허용 시 조회는
          자동으로 포함됩니다.
        </p>
      </div>
      {notice ? <p className="text-xs text-amber-700">{notice}</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-medium">권한 그룹 선택</h3>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <select
            className="min-w-[200px] rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.group_name}
              </option>
            ))}
          </select>
          <Button type="button" onClick={() => void loadMatrix(groupId)}>
            새로고침
          </Button>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-medium text-slate-600">새 그룹</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              className="min-w-[180px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="그룹명"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <input
              className="min-w-[220px] flex-[2] rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="설명(선택)"
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={createGroup}>
              그룹 추가
            </Button>
          </div>
        </div>
      </div>

      {groupId && matrix.length ? (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button type="button" onClick={saveMatrix}>
              저장
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <tr>
                  <th className="px-3 py-2">페이지</th>
                  <th className="px-3 py-2 w-28">조회</th>
                  <th className="px-3 py-2 w-28">수정</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((m, idx) => (
                  <tr
                    key={m.page_key}
                    className="border-b border-slate-100 transition-colors duration-150 last:border-0 hover:bg-slate-100/90 has-[input:focus]:bg-indigo-50/95 has-[input:focus]:shadow-[inset_3px_0_0_0_rgb(99_102_241)]"
                  >
                    <td className="px-3 py-2 align-middle">
                      <span className="font-medium text-slate-800">{m.label}</span>
                      <span className="ml-2 font-mono text-[10px] text-slate-400">{m.page_key}</span>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="checkbox"
                        className="h-5 w-5 cursor-pointer accent-indigo-600"
                        checked={m.can_read === "Y"}
                        onChange={(e) => setRead(idx, e.target.checked)}
                        aria-label={`${m.label} 조회`}
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="checkbox"
                        className="h-5 w-5 cursor-pointer accent-indigo-600"
                        checked={m.can_write === "Y"}
                        onChange={(e) => setWrite(idx, e.target.checked)}
                        aria-label={`${m.label} 수정`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
