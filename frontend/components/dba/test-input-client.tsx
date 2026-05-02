"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiHeaders } from "@/lib/api-headers";

type DbConn = {
  db_conn_id: string;
  conn_name: string;
  db_kind: string;
  host: string;
  port: number;
  db_name: string;
  use_yn: string;
};

export function TestInputClient() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api", []);
  const [psrNumber, setPsrNumber] = useState("");
  const [requestTitle, setRequestTitle] = useState("");
  const [requesterEmpNo, setRequesterEmpNo] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterDept, setRequesterDept] = useState("");
  const [developerEmpNo, setDeveloperEmpNo] = useState("");
  const [developerName, setDeveloperName] = useState("");
  const [developerDept, setDeveloperDept] = useState("");
  const [dbConnId, setDbConnId] = useState("");
  const [sqlText, setSqlText] = useState("SELECT 1 FROM DUAL");
  const [viewableDate, setViewableDate] = useState("");
  const [viewableHour, setViewableHour] = useState("00");
  const [connections, setConnections] = useState<DbConn[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const startedAt = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:00:00`;
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const minDate = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const defaultEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    return { date: `${yyyy}-${mm}-${dd}`, hour: hh };
  }, []);

  useEffect(() => {
    setViewableDate(defaultEnd.date);
    setViewableHour(defaultEnd.hour);
  }, [defaultEnd.date, defaultEnd.hour]);

  useEffect(() => {
    const load = async () => {
      const resp = await fetch(`${apiBase}/v1/db-connections`, { headers: apiHeaders() });
      if (!resp.ok) throw new Error(await resp.text());
      const rows = ((await resp.json()) as DbConn[]).filter((x) => x.use_yn === "Y");
      setConnections(rows);
      if (rows.length > 0) setDbConnId(rows[0].db_conn_id);
    };
    void load().catch((e) => setError(e instanceof Error ? e.message : "연결 목록 조회 실패"));
  }, []);

  const submit = async () => {
    setSending(true);
    setMessage("");
    setError("");
    try {
      const resp = await fetch(`${apiBase}/v1/test-input/submit`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          psr_number: psrNumber,
          request_title: requestTitle || null,
          requester_emp_no: requesterEmpNo || null,
          requester_name: requesterName || null,
          requester_dept: requesterDept || null,
          developer_emp_no: developerEmpNo || null,
          developer_name: developerName || null,
          developer_dept: developerDept || null,
          db_conn_id: dbConnId,
          sql_text: sqlText,
          viewable_until: buildViewableIso(viewableDate, viewableHour),
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        if (txt.includes("viewable_until_must_be_after_start")) {
          throw new Error("조회 종료일은 조회 시작일보다 늦어야 합니다.");
        }
        if (txt.includes("viewable_until_exceeds_7_days")) {
          throw new Error("조회 가능 종료일은 현재 시점 기준 7일 이내로만 설정할 수 있습니다.");
        }
        throw new Error(txt);
      }
      const data = (await resp.json()) as { job_id: string };
      setMessage(`송신 완료: ${data.job_id} (DBA 승인함으로 전달됨)`);
      setPsrNumber("");
      setRequestTitle("");
      setRequesterEmpNo("");
      setRequesterName("");
      setRequesterDept("");
      setDeveloperEmpNo("");
      setDeveloperName("");
      setDeveloperDept("");
      setSqlText("SELECT 1 FROM DUAL");
      setViewableDate(defaultEnd.date);
      setViewableHour(defaultEnd.hour);
    } catch (e) {
      setError(e instanceof Error ? e.message : "송신 실패");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">테스트 입력 페이지</h1>
        <p className="text-sm text-slate-600">
          ITSM 입력을 대체해 PSR 번호/커넥션/쿼리를 수동 입력 후 DBA 승인함으로 송신합니다.
        </p>
      </div>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-600">PSR 번호</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={psrNumber}
              onChange={(e) => setPsrNumber(e.target.value)}
              placeholder="예: PSR-TEST-3001"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">요청 제목</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={requestTitle}
              onChange={(e) => setRequestTitle(e.target.value)}
              placeholder="예: 2026년 1분기 인사현황 조회"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">커넥션 선택</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={dbConnId}
              onChange={(e) => setDbConnId(e.target.value)}
            >
              <option value="">선택</option>
              {connections.map((c) => (
                <option key={c.db_conn_id} value={c.db_conn_id}>
                  {c.conn_name} ({c.db_kind} / {c.host}:{c.port}/{c.db_name})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">작성자 사번</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={requesterEmpNo}
              onChange={(e) => setRequesterEmpNo(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">작성자 이름</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">작성자 부서</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={requesterDept}
              onChange={(e) => setRequesterDept(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">개발자 사번</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={developerEmpNo}
              onChange={(e) => setDeveloperEmpNo(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">개발자 이름</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={developerName}
              onChange={(e) => setDeveloperName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">개발자 부서</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={developerDept}
              onChange={(e) => setDeveloperDept(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs text-slate-600">쿼리</label>
          <textarea
            className="h-56 w-full rounded-md border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-100"
            value={sqlText}
            onChange={(e) => setSqlText(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs text-slate-600">조회 시작일(고정)</label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {startedAt}
            </div>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs text-slate-600">조회 종료일(최대 7일)</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={viewableDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => setViewableDate(e.target.value)}
              />
              <select
                className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm"
                value={viewableHour}
                onChange={(e) => setViewableHour(e.target.value)}
              >
                {Array.from({ length: 24 }, (_, idx) => {
                  const h = String(idx).padStart(2, "0");
                  return (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  );
                })}
              </select>
            </div>
            <p className="mt-1 text-xs text-slate-500">시간 단위까지만 설정됩니다.</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => void submit()}
            disabled={!psrNumber || !dbConnId || !sqlText || sending || !isValidEndDate(viewableDate, viewableHour)}
          >
            송신
          </Button>
        </div>
      </div>
    </section>
  );
}

function buildViewableIso(dateValue: string, hourValue: string): string | null {
  if (!dateValue) return null;
  const hour = hourValue || "00";
  const dt = new Date(`${dateValue}T${hour}:00:00`);
  return dt.toISOString();
}

function isValidEndDate(dateValue: string, hourValue: string): boolean {
  const endIso = buildViewableIso(dateValue, hourValue);
  if (!endIso) return false;
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return new Date(endIso).getTime() > now.getTime();
}
