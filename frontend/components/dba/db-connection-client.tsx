"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Conn = {
  db_conn_id: string;
  conn_name: string;
  db_kind: string;
  host: string;
  port: number;
  db_name: string;
  service_name?: string | null;
  username: string;
  password_masked: string;
  use_yn: string;
};

type FormState = {
  conn_name: string;
  db_kind: string;
  host: string;
  port: number;
  db_name: string;
  service_name: string;
  username: string;
  password: string;
  use_yn: string;
};

const EMPTY_FORM: FormState = {
  conn_name: "",
  db_kind: "oracle",
  host: "",
  port: 1521,
  db_name: "",
  service_name: "",
  username: "",
  password: "",
  use_yn: "Y",
};

const DEFAULT_PORT: Record<string, number> = {
  oracle: 1521,
  mssql: 1433,
  postgres: 5432,
};

export function DbConnectionClient() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api", []);
  const [rows, setRows] = useState<Conn[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const load = async () => {
    setError("");
    const resp = await fetch(`${apiBase}/v1/db-connections`, { headers: { "X-User-Role": "DBA" } });
    if (!resp.ok) throw new Error(await resp.text());
    setRows((await resp.json()) as Conn[]);
  };

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "조회 실패"));
  }, []);

  const onPick = (row: Conn) => {
    setSelectedId(row.db_conn_id);
  };

  const submit = async () => {
    setError("");
    setMessage("");
    const url = `${apiBase}/v1/db-connections`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Role": "DBA" },
      body: JSON.stringify(form),
    });
    if (!resp.ok) throw new Error(await resp.text());
    setMessage("등록 완료");
    setForm(EMPTY_FORM);
    setModalOpen(false);
    await load();
  };

  const remove = async (id: string) => {
    setError("");
    setMessage("");
    const resp = await fetch(`${apiBase}/v1/db-connections/${id}`, {
      method: "DELETE",
      headers: { "X-User-Role": "DBA" },
    });
    if (!resp.ok) throw new Error(await resp.text());
    setMessage("삭제 완료");
    if (selectedId === id) {
      setSelectedId(null);
    }
    await load();
  };
  const selected = rows.find((r) => r.db_conn_id === selectedId) ?? null;

  const testConnection = async (row: Conn) => {
    setError("");
    setMessage("");
    const resp = await fetch(`${apiBase}/v1/db-connections/${row.db_conn_id}/test`, {
      method: "POST",
      headers: { "X-User-Role": "DBA" },
    });
    if (!resp.ok) throw new Error(await resp.text());
    setMessage("연결 테스트 성공");
  };

  const onChangeDbKind = (nextKind: string) => {
    setForm((prev) => ({
      ...prev,
      db_kind: nextKind,
      port: DEFAULT_PORT[nextKind] ?? prev.port,
      service_name: nextKind === "oracle" ? prev.service_name : "",
    }));
  };

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">DB Connection 관리</h1>
          <p className="text-sm text-slate-600">
            Oracle/MSSQL/PostgreSQL 접속 정보를 카드로 관리하고 상세 확장 뷰에서 테스트/삭제를 수행합니다.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>등록</Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-medium">등록된 연결 리스트</h3>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <button
              key={row.db_conn_id}
              type="button"
              className={`rounded-lg border p-4 text-left transition ${
                selectedId === row.db_conn_id
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-indigo-200"
              }`}
              onClick={() => onPick(row)}
            >
              <p className="text-sm font-semibold">{row.conn_name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {row.db_kind.toUpperCase()} / {row.host}:{row.port}
              </p>
              <p className="mt-1 text-xs text-slate-500">{row.db_name}</p>
            </button>
          ))}
          {!rows.length ? <p className="text-sm text-slate-500">등록된 연결이 없습니다.</p> : null}
        </div>
      </div>

      {selected ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 font-medium">상세 정보</h3>
          <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-2">
            <p>연결명: {selected.conn_name}</p>
            <p>DBMS: {selected.db_kind}</p>
            <p>호스트: {selected.host}</p>
            <p>포트: {selected.port}</p>
            <p>DB명: {selected.db_name}</p>
            <p>서비스명: {selected.service_name || "-"}</p>
            <p>계정: {selected.username}</p>
            <p>비밀번호: {selected.password_masked}</p>
            <p>사용 여부: {selected.use_yn}</p>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => void testConnection(selected)}>
              Connection Test
            </Button>
            <Button variant="destructive" onClick={() => void remove(selected.db_conn_id)}>
              삭제
            </Button>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">새 DB Connection 등록</h3>
              <Button
                variant="outline"
                onClick={() => {
                  setModalOpen(false);
                  setForm(EMPTY_FORM);
                }}
              >
                닫기
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-600">DBMS 종류</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.db_kind}
                  onChange={(e) => onChangeDbKind(e.target.value)}
                >
                  <option value="oracle">Oracle</option>
                  <option value="mssql">SQL Server</option>
                  <option value="postgres">PostgreSQL</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">연결명</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.conn_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, conn_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">호스트</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.host}
                  onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">포트</label>
                <input
                  type="number"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.port}
                  onChange={(e) => setForm((prev) => ({ ...prev, port: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">DB명</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.db_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, db_name: e.target.value }))}
                />
              </div>
              {form.db_kind === "oracle" ? (
                <div>
                  <label className="mb-1 block text-xs text-slate-600">서비스명</label>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={form.service_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, service_name: e.target.value }))}
                  />
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-xs text-slate-600">계정</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">비밀번호</label>
                <input
                  type="password"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600">사용 여부</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.use_yn}
                  onChange={(e) => setForm((prev) => ({ ...prev, use_yn: e.target.value }))}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(EMPTY_FORM)}>
                초기화
              </Button>
              <Button onClick={() => void submit()}>등록</Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
