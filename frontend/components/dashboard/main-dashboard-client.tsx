"use client";

import { useEffect, useMemo, useState } from "react";
import { ApprovalQueue } from "@/components/dashboard/approval-queue";
import { MetadataDictionary } from "@/components/dashboard/metadata-dictionary";
import { QueryHistoryTable, type DashboardQueryRow } from "@/components/dashboard/query-history-table";

type Stats = {
  total_requests: number;
  pending_approvals: number;
  pii_detected_count: number;
  high_risk_count: number;
};

type TabKey = "history" | "approval" | "metadata";

export function MainDashboardClient() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api", []);
  const [stats, setStats] = useState<Stats>({
    total_requests: 0,
    pending_approvals: 0,
    pii_detected_count: 0,
    high_risk_count: 0,
  });
  const [rows, setRows] = useState<DashboardQueryRow[]>([]);
  const [tab, setTab] = useState<TabKey>("history");
  const [error, setError] = useState<string>("");
  const userId = "admin";
  const isApprover = userId === "admin";

  useEffect(() => {
    const load = async () => {
      try {
        const headers = { "X-User-Id": "admin", "X-Team-Id": "platform" };
        const [statsResp, queriesResp] = await Promise.all([
          fetch(`${apiBase}/v1/dashboard/stats`, { headers }),
          fetch(`${apiBase}/v1/dashboard/queries`, { headers }),
        ]);
        if (!statsResp.ok || !queriesResp.ok) throw new Error("dashboard api error");
        setStats((await statsResp.json()) as Stats);
        setRows((await queriesResp.json()) as DashboardQueryRow[]);
      } catch (e) {
        setError("백엔드 연결이 없어 목업 데이터로 대체합니다.");
        setStats({
          total_requests: 2,
          pending_approvals: 1,
          pii_detected_count: 2,
          high_risk_count: 1,
        });
        setRows([
          {
            id: "mock-q-001",
            status: "awaiting_dba",
            created_at: "2026-04-21 09:00",
            risk_level: "High",
            pii_items: [
              { name: "주민번호", risk: "High" },
              { name: "성명", risk: "Medium" },
            ],
            sql_preview: "SELECT 주민번호, 성명 FROM RPT.CUSTOMER WHERE ROWNUM <= 10",
            sql_text: "SELECT 주민번호, 성명 FROM RPT.CUSTOMER WHERE ROWNUM <= 10",
          },
          {
            id: "mock-q-002",
            status: "approved",
            created_at: "2026-04-20 14:30",
            risk_level: "Low",
            pii_items: [{ name: "이메일", risk: "Low" }],
            sql_preview: "SELECT 고객ID, 이메일 FROM RPT.ORDER_CONTACT",
            sql_text: "SELECT 고객ID, 이메일 FROM RPT.ORDER_CONTACT",
          },
        ]);
      }
    };
    void load();
  }, [apiBase]);

  const metrics = [
    { title: "총 요청", value: stats.total_requests },
    { title: "승인 대기", value: stats.pending_approvals },
    { title: "PII 탐지", value: stats.pii_detected_count },
    { title: "PII 위험성(High)", value: stats.high_risk_count },
  ];

  return (
    <section className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">팀 기반 쿼리 거버넌스 대시보드</h1>
        {error ? <p className="mt-1 text-xs text-amber-700">{error}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.title} className="rounded-md border border-neutral-300 bg-white p-4">
            <p className="text-xs text-neutral-500">{m.title}</p>
            <p className="mt-1 text-2xl font-bold">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-neutral-200">
        <button
          className={`rounded-t-md px-3 py-2 text-sm ${tab === "history" ? "bg-black text-white" : "bg-white text-neutral-600"}`}
          onClick={() => setTab("history")}
        >
          쿼리 이력
        </button>
        <button
          className={`rounded-t-md px-3 py-2 text-sm ${tab === "approval" ? "bg-black text-white" : "bg-white text-neutral-600"}`}
          onClick={() => setTab("approval")}
        >
          승인 대기함
        </button>
        <button
          className={`rounded-t-md px-3 py-2 text-sm ${tab === "metadata" ? "bg-black text-white" : "bg-white text-neutral-600"}`}
          onClick={() => setTab("metadata")}
        >
          메타데이터 사전
        </button>
      </div>

      {tab === "history" ? <QueryHistoryTable rows={rows} /> : null}
      {tab === "approval" ? <ApprovalQueue rows={rows.filter((r) => r.status === "awaiting_dba")} isApprover={isApprover} apiBase={apiBase} /> : null}
      {tab === "metadata" ? <MetadataDictionary apiBase={apiBase} /> : null}
    </section>
  );
}
