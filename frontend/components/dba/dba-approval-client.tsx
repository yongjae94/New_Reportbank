"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiHeaders } from "@/lib/api-headers";

type Job = {
  id: string;
  psr_number: string;
  request_title?: string | null;
  requester_emp_no?: string | null;
  requester_name?: string | null;
  requester_dept?: string | null;
  developer_emp_no?: string | null;
  developer_name?: string | null;
  developer_dept?: string | null;
  status: string;
  sql_text: string;
  target_db_kind: string;
  executed_db_conn_id?: string | null;
  viewable_until?: string | null;
  dba_reviewer?: string | null;
  infosec_reviewer?: string | null;
};

type DbConn = {
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

export function DbaApprovalClient() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api", []);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [historyJobs, setHistoryJobs] = useState<Job[]>([]);
  const [connections, setConnections] = useState<DbConn[]>([]);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedConnId, setSelectedConnId] = useState<string>("");
  const [editedSql, setEditedSql] = useState("");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewableDate, setViewableDate] = useState("");
  const [viewableHour, setViewableHour] = useState("00");
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

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsResp, connResp] = await Promise.all([
        fetch(`${apiBase}/workflow/jobs/pending-dba`, { headers: apiHeaders() }),
        fetch(`${apiBase}/v1/db-connections`, { headers: apiHeaders() }),
      ]);
      if (!jobsResp.ok) throw new Error(await jobsResp.text());
      if (!connResp.ok) throw new Error(await connResp.text());
      const jobsData = (await jobsResp.json()) as Job[];
      const connData = (await connResp.json()) as DbConn[];
      setJobs(jobsData.filter((x) => x.status === "awaiting_dba"));
      setConnections(connData.filter((x) => x.use_yn === "Y"));
      const historyResp = await fetch(`${apiBase}/workflow/jobs/dba-history`, { headers: apiHeaders() });
      if (!historyResp.ok) throw new Error(await historyResp.text());
      setHistoryJobs((await historyResp.json()) as Job[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selectedJob) {
      setEditedSql(selectedJob.sql_text);
      if (selectedJob.viewable_until) {
        const dt = new Date(selectedJob.viewable_until);
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const dd = String(dt.getDate()).padStart(2, "0");
        const hh = String(dt.getHours()).padStart(2, "0");
        setViewableDate(`${yyyy}-${mm}-${dd}`);
        setViewableHour(hh);
      } else {
        setViewableDate("");
        setViewableHour("00");
      }
      if (selectedJob.executed_db_conn_id) {
        setSelectedConnId(selectedJob.executed_db_conn_id);
      }
    }
  }, [selectedJobId, selectedJob?.sql_text]);

  const execute = async () => {
    if (!selectedJob || !selectedConnId) return;
    setExecuting(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBase}/workflow/jobs/${selectedJob.id}/execute`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          dba_user: "dba.user",
          db_conn_id: selectedConnId,
          edited_sql: editedSql,
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
      await load();
      setSelectedJobId(null);
      setEditedSql("");
      setViewableDate("");
      setViewableHour("00");
    } catch (e) {
      setError(e instanceof Error ? e.message : "실행 실패");
    } finally {
      setExecuting(false);
    }
  };

  const returnToAuthor = async () => {
    if (!selectedJob) return;
    setReturning(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBase}/workflow/jobs/${selectedJob.id}/return`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          dba_user: "dba.user",
          reason: "DBA 반송(작성자 되돌림/삭제)",
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      await load();
      setSelectedJobId(null);
      setEditedSql("");
      setViewableDate("");
      setViewableHour("00");
    } catch (e) {
      setError(e instanceof Error ? e.message : "반송 실패");
    } finally {
      setReturning(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">DBA 승인함</h1>
          <p className="text-sm text-slate-600">실행 대기 PSR을 검토/실행하고 승인 이력을 조회합니다.</p>
        </div>
        {tab === "pending" ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void returnToAuthor()}
              disabled={!selectedJob || returning}
            >
              {returning ? <Loader2 className="h-4 w-4 animate-spin" /> : "반송(삭제)"}
            </Button>
            <Button
              onClick={() => void execute()}
              disabled={!selectedJob || !selectedConnId || executing || !isValidEndDate(viewableDate, viewableHour)}
            >
              {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : "실행"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`rounded-full px-3 py-1 text-sm ${tab === "pending" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}
        >
          실행 대기
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`rounded-full px-3 py-1 text-sm ${tab === "history" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}
        >
          승인 이력
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">불러오는 중...</p> : null}

      {tab === "pending" ? (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h3 className="mb-2 font-medium">실행 대기 PSR</h3>
          <div className="space-y-2">
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setSelectedJobId(job.id)}
                className={`w-full rounded-md border p-3 text-left ${
                  selectedJobId === job.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200"
                }`}
              >
                <p className="text-sm font-medium">{job.psr_number}</p>
                <p className="text-xs text-slate-500">
                  제목: {job.request_title ?? "-"} / 작성자: {job.requester_name ?? "-"}({job.requester_emp_no ?? "-"})
                </p>
                <p className="text-xs text-slate-500">
                  작성부서: {job.requester_dept ?? "-"} / 개발자: {job.developer_name ?? "-"}({job.developer_emp_no ?? "-"})
                </p>
              </button>
            ))}
            {!jobs.length ? <p className="text-sm text-slate-500">실행 대기 항목이 없습니다.</p> : null}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-medium">상세 검토/편집</h3>
          {selectedJob ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p>요청제목: {selectedJob.request_title ?? "-"}</p>
              <p>
                작성자: {selectedJob.requester_name ?? "-"} ({selectedJob.requester_emp_no ?? "-"}) /{" "}
                {selectedJob.requester_dept ?? "-"}
              </p>
              <p>
                개발자: {selectedJob.developer_name ?? "-"} ({selectedJob.developer_emp_no ?? "-"}) /{" "}
                {selectedJob.developer_dept ?? "-"}
              </p>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">타겟 DB 선택</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={selectedConnId}
              onChange={(e) => setSelectedConnId(e.target.value)}
            >
              <option value="">선택</option>
              {connections.map((c) => (
                <option key={c.db_conn_id} value={c.db_conn_id}>
                  {c.conn_name} ({c.db_kind} / {c.host}:{c.port})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">쿼리 편집</label>
            <textarea
              className="h-[420px] w-full rounded-md border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-100"
              value={editedSql}
              onChange={(e) => setEditedSql(e.target.value)}
              placeholder="SQL을 검토/수정하세요."
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">조회 시작일(고정)</label>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {startedAt}
              </div>
            </div>
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">조회 종료일(최대 7일)</label>
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
        </div>
      </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 font-medium">DBA 승인 이력</h3>
          <div className="space-y-2">
            {historyJobs.map((job) => (
              <div key={job.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-medium">{job.psr_number}</p>
                <p className="text-xs text-slate-600">
                  제목: {job.request_title ?? "-"} / 작성자: {job.requester_name ?? "-"}({job.requester_emp_no ?? "-"})
                </p>
                <p className="text-xs text-slate-600">
                  상태: {job.status} / DBA 승인자: {job.dba_reviewer ?? "-"} / 정보보호 승인자: {job.infosec_reviewer ?? "-"}
                </p>
              </div>
            ))}
            {!historyJobs.length ? <p className="text-sm text-slate-500">승인 이력이 없습니다.</p> : null}
          </div>
        </div>
      )}
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
