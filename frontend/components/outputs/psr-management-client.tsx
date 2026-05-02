"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiHeaders } from "@/lib/api-headers";

type PsrFlow = {
  job_id: string;
  psr_number: string;
  status: string;
  sql_text: string;
  final_sql_text?: string | null;
  target_db_kind: string;
  snapshot_rows: Array<Record<string, string | number>>;
  snapshot_columns: string[];
  requested_at?: string | null;
  viewable_until?: string | null;
  access_mode: string;
};

function statusClass(status: string): string {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "awaiting_infosec") return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}

export function PsrManagementClient() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api", []);
  const [psrList, setPsrList] = useState<PsrFlow[]>([]);
  const [selected, setSelected] = useState<PsrFlow | null>(null);
  const [realtimeRows, setRealtimeRows] = useState<Array<Record<string, string | number>>>([]);
  const [realtimeTotal, setRealtimeTotal] = useState(0);
  const [loadingRealtime, setLoadingRealtime] = useState(false);
  const [notice, setNotice] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const resp = await fetch(`${apiBase}/v1/psr/outputs`, { headers: apiHeaders() });
      if (!resp.ok) throw new Error(await resp.text());
      const data = (await resp.json()) as PsrFlow[];
      setPsrList(data);
    };
    void load().catch((e) => setNotice(e instanceof Error ? e.message : "조회 실패"));
  }, []);

  const clickPsr = (row: PsrFlow) => {
    if (row.status !== "completed") {
      setSelected(null);
      setNotice("산출 완료 상태의 PSR만 상세 데이터 조회가 가능합니다.");
      return;
    }
    if (row.access_mode !== "승인") {
      setSelected(null);
      setNotice("정보보호 담당자가 잠금 처리하여 현재 조회할 수 없습니다.");
      return;
    }
    if (row.viewable_until && new Date(row.viewable_until).getTime() < Date.now()) {
      setSelected(null);
      setNotice("조회 가능 기간이 만료된 PSR입니다.");
      return;
    }
    setNotice("");
    setSelected(row);
    setRealtimeRows([]);
    setRealtimeTotal(0);
  };

  const realtimeColumns = realtimeRows[0] ? Object.keys(realtimeRows[0]) : [];
  const snapshotColumns = selected?.snapshot_columns?.length
    ? selected.snapshot_columns
    : Object.keys(selected?.snapshot_rows?.[0] ?? {});

  const runRealtime = async () => {
    if (!selected) return;
    setLoadingRealtime(true);
    try {
      const resp = await fetch(`${apiBase}/v1/psr/${selected.job_id}/realtime?limit=1000`, {
        method: "POST",
        headers: apiHeaders(),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = (await resp.json()) as {
        row_count: number;
        rows: Array<Record<string, string | number>>;
      };
      setRealtimeRows(data.rows);
      setRealtimeTotal(data.row_count);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "실시간 조회 실패");
    } finally {
      setLoadingRealtime(false);
    }
  };

  const exportCsv = () => {
    if (!realtimeRows.length) return;
    const keys = Object.keys(realtimeRows[0]);
    const header = keys.join(",");
    const body = realtimeRows
      .map((r) => keys.map((k) => `"${String(r[k] ?? "").replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "psr-realtime.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTxt = () => {
    if (!realtimeRows.length) return;
    const keys = Object.keys(realtimeRows[0]);
    const header = keys.join("\t");
    const body = realtimeRows.map((r) => keys.map((k) => String(r[k] ?? "")).join("\t")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "psr-realtime.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = () => {
    if (!realtimeRows.length) return;
    const ws = XLSX.utils.json_to_sheet(realtimeRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PSR_REALTIME");
    XLSX.writeFile(wb, "psr-realtime.xlsx");
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">PSR 산출</h1>
        <p className="mt-1 text-sm text-slate-600">
          PSR 요청 목록을 확인하고, 산출 완료 항목의 결과를 샘플 및 실시간 데이터로 조회합니다.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-medium">PSR 요청 리스트</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">PSR 번호</th>
                <th className="px-3 py-2 text-left">잡 ID</th>
                <th className="px-3 py-2 text-left">DB 종류</th>
                <th className="px-3 py-2 text-left">요청일</th>
                <th className="px-3 py-2 text-left">조회 시작일</th>
                <th className="px-3 py-2 text-left">조회 종료일</th>
                <th className="px-3 py-2 text-left">접근 상태</th>
                <th className="px-3 py-2 text-left">진행 상태</th>
              </tr>
            </thead>
            <tbody>
              {psrList.map((row) => (
                <tr
                  key={row.job_id}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  onClick={() => clickPsr(row)}
                >
                  <td className="px-3 py-2 font-medium text-indigo-700">{row.psr_number}</td>
                  <td className="px-3 py-2 text-xs">{row.job_id}</td>
                  <td className="px-3 py-2">{row.target_db_kind}</td>
                  <td className="px-3 py-2">{row.requested_at ?? "-"}</td>
                  <td className="px-3 py-2">{row.requested_at ? row.requested_at.replace("T", " ").slice(0, 19) : "-"}</td>
                  <td className="px-3 py-2">{row.viewable_until ? row.viewable_until.replace("T", " ").slice(0, 19) : "-"}</td>
                  <td className="px-3 py-2">{row.access_mode}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(row.status)}`}>
                      {row.status === "completed" ? "산출 완료" : row.status === "awaiting_infosec" ? "정보보호 승인대기" : row.status}
                    </span>
                    {row.access_mode !== "승인" ? (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">잠금</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {notice ? <p className="text-sm text-amber-700">{notice}</p> : null}

      {selected ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">데이터 미리보기 (Top10)</h3>
            <Button size="sm" onClick={() => void runRealtime()} disabled={loadingRealtime}>
              {loadingRealtime ? <Loader2 className="h-4 w-4 animate-spin" /> : "실시간 전체데이터 조회"}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>{snapshotColumns.map((c) => <th key={c} className="px-3 py-2 text-left">{c}</th>)}</tr>
              </thead>
              <tbody>
                {selected.snapshot_rows.map((r, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    {snapshotColumns.map((c) => (
                      <td key={c} className="px-3 py-2">{String(r[c] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {realtimeRows.length ? (
            <div className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50/30 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">실시간 조회 결과 ({realtimeTotal}건)</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={exportXlsx}>Excel</Button>
                  <Button size="sm" variant="outline" onClick={exportCsv}>CSV</Button>
                  <Button size="sm" variant="outline" onClick={exportTxt}>TXT</Button>
                </div>
              </div>
              {realtimeTotal > 1000 ? (
                <p className="text-xs text-amber-700">데이터가 너무 많아 상위 1000건만 표시됩니다. 전체는 다운로드하세요.</p>
              ) : null}
              <div className={realtimeRows.length > 100 ? "max-h-[520px] overflow-auto rounded-md border border-slate-200 bg-white" : "rounded-md border border-slate-200 bg-white"}>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>{realtimeColumns.map((c) => <th key={c} className="px-3 py-2 text-left">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {realtimeRows.map((r, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        {realtimeColumns.map((c) => <td key={c} className="px-3 py-2">{String(r[c] ?? "")}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
