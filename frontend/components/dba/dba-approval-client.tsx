"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Job = {
  id: string;
  psr_number: string;
  status: string;
  sql_text: string;
  target_db_kind: string;
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
  const [connections, setConnections] = useState<DbConn[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedConnId, setSelectedConnId] = useState<string>("");
  const [editedSql, setEditedSql] = useState("");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsResp, connResp] = await Promise.all([
        fetch(`${apiBase}/workflow/jobs/pending-dba`, { headers: { "X-User-Role": "DBA" } }),
        fetch(`${apiBase}/v1/db-connections`, { headers: { "X-User-Role": "DBA" } }),
      ]);
      if (!jobsResp.ok) throw new Error(await jobsResp.text());
      if (!connResp.ok) throw new Error(await connResp.text());
      const jobsData = (await jobsResp.json()) as Job[];
      const connData = (await connResp.json()) as DbConn[];
      setJobs(jobsData.filter((x) => x.status === "awaiting_dba"));
      setConnections(connData.filter((x) => x.use_yn === "Y"));
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
    }
  }, [selectedJobId, selectedJob?.sql_text]);

  const execute = async () => {
    if (!selectedJob || !selectedConnId) return;
    setExecuting(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBase}/workflow/jobs/${selectedJob.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Role": "DBA" },
        body: JSON.stringify({
          dba_user: "dba.user",
          db_conn_id: selectedConnId,
          edited_sql: editedSql,
        }),
      });
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      await load();
      setSelectedJobId(null);
      setEditedSql("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "실행 실패");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">DBA 승인함</h1>
          <p className="text-sm text-slate-600">실행 대기 PSR을 검토하고 쿼리를 수정 후 실행합니다.</p>
        </div>
        <Button onClick={() => void execute()} disabled={!selectedJob || !selectedConnId || executing}>
          {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : "실행"}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">불러오는 중...</p> : null}

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
                <p className="text-xs text-slate-500">상태: {job.status}</p>
              </button>
            ))}
            {!jobs.length ? <p className="text-sm text-slate-500">실행 대기 항목이 없습니다.</p> : null}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-medium">상세 검토/편집</h3>
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
        </div>
      </div>
    </section>
  );
}
