"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { getPsrRecords, savePsrRecords, type PsrRecord } from "@/lib/psr-store";

function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

type DataRow = Record<string, string | number>;
type ColumnMeta = { name: string; type: string };

const columnMeta: ColumnMeta[] = [
  { name: "customer_id", type: "NUMBER" },
  { name: "customer_name", type: "VARCHAR2" },
  { name: "grade", type: "VARCHAR2" },
  { name: "signup_at", type: "DATE" },
];

function makeRows(count: number): DataRow[] {
  return Array.from({ length: count }, (_, i) => ({
    customer_id: 100000 + i,
    customer_name: `고객${i + 1}`,
    grade: i % 3 === 0 ? "VIP" : "NORMAL",
    signup_at: `2024-01-${String((i % 28) + 1).padStart(2, "0")}`,
  }));
}

const snapshotRowsByPsr: Record<string, DataRow[]> = {
  "PSR-2026-1001": makeRows(10),
  "PSR-2026-1004": makeRows(10),
};

const realtimeTotalByPsr: Record<string, number> = {
  "PSR-2026-1001": 1320,
  "PSR-2026-1004": 240,
};

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ApprovalsPage() {
  const [rows, setRows] = useState<PsrRecord[]>([]);
  const [selectedPsrNo, setSelectedPsrNo] = useState<string | null>(null);
  const [loadingRealtime, setLoadingRealtime] = useState(false);
  const [fullRows, setFullRows] = useState<DataRow[] | null>(null);
  const [fullTotal, setFullTotal] = useState<number>(0);

  useEffect(() => {
    setRows(getPsrRecords());
  }, []);

  const pending = useMemo(
    () => rows.filter((r) => r.status === "정보보호 승인대기"),
    [rows]
  );
  const completed = useMemo(
    () => rows.filter((r) => r.status === "산출 완료"),
    [rows]
  );
  const selected = useMemo(
    () => rows.find((r) => r.psrNo === selectedPsrNo) ?? null,
    [rows, selectedPsrNo]
  );
  const previewRows = selected ? snapshotRowsByPsr[selected.psrNo] ?? [] : [];
  const displayRows = useMemo(() => {
    if (!fullRows) return [];
    return fullRows.slice(0, 1000);
  }, [fullRows]);

  const commit = (next: PsrRecord[]) => {
    setRows(next);
    savePsrRecords(next);
  };

  const approve = (psrNo: string) => {
    const next = rows.map((r) =>
      r.psrNo === psrNo
        ? {
            ...r,
            status: "산출 완료" as const,
            accessMode: "승인" as const,
            snapshotAt: r.snapshotAt ?? nowStamp(),
          }
        : r
    );
    commit(next);
    setSelectedPsrNo(psrNo);
  };

  const toggleLock = (psrNo: string) => {
    const next = rows.map((r) =>
      r.psrNo === psrNo
        ? {
            ...r,
            accessMode: r.accessMode === "승인" ? ("잠금" as const) : ("승인" as const),
          }
        : r
    );
    commit(next);
  };

  const loadRealtime = async () => {
    if (!selected || selected.status !== "산출 완료") return;
    setLoadingRealtime(true);
    await new Promise((r) => setTimeout(r, 1100));
    const total = realtimeTotalByPsr[selected.psrNo] ?? 120;
    setFullTotal(total);
    setFullRows(makeRows(total));
    setLoadingRealtime(false);
  };

  const exportCsv = () => {
    if (!displayRows.length) return;
    const header = Object.keys(displayRows[0]).join(",");
    const body = displayRows
      .map((r) => Object.values(r).map((v) => `"${String(v).replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");
    downloadTextFile("psr-approval-data.csv", `${header}\n${body}`, "text/csv;charset=utf-8;");
  };

  const exportTxt = () => {
    if (!displayRows.length) return;
    const header = Object.keys(displayRows[0]).join("\t");
    const body = displayRows.map((r) => Object.values(r).join("\t")).join("\n");
    downloadTextFile("psr-approval-data.txt", `${header}\n${body}`, "text/plain;charset=utf-8;");
  };

  const exportXlsx = () => {
    if (!displayRows.length) return;
    const ws = XLSX.utils.json_to_sheet(displayRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PSR_APPROVAL_DATA");
    XLSX.writeFile(wb, "psr-approval-data.xlsx");
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">승인 관리함</h1>
        <p className="mt-1 text-sm text-slate-600">
          정보보호 담당자가 PSR 산출 결과의 공개를 승인/회수(잠금)합니다.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">정보보호 승인 대기 PSR</h3>
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
            {pending.length}건 대기
          </span>
        </div>
        <div className="space-y-2">
          {pending.length === 0 ? (
            <p className="text-sm text-slate-500">현재 승인 대기 건이 없습니다.</p>
          ) : (
            pending.map((row) => (
              <div
                key={row.psrNo}
                className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                  selectedPsrNo === row.psrNo
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-slate-200 bg-slate-50"
                }`}
                onClick={() => setSelectedPsrNo(row.psrNo)}
              >
                <div>
                  <p className="text-sm font-medium">{row.psrNo} · {row.title}</p>
                  <p className="text-xs text-slate-500">요청자: {row.requester} / 요청일: {row.requestedAt}</p>
                </div>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    approve(row.psrNo);
                  }}
                >
                  승인
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-medium">산출 완료 PSR (공개/잠금 제어)</h3>
        <div className="space-y-2">
          {completed.map((row) => (
            <div
              key={row.psrNo}
              className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                selectedPsrNo === row.psrNo ? "border-indigo-300 bg-indigo-50" : "border-slate-200"
              }`}
              onClick={() => setSelectedPsrNo(row.psrNo)}
            >
              <div>
                <p className="text-sm font-medium">{row.psrNo} · {row.title}</p>
                <p className="text-xs text-slate-500">
                  요청자: {row.requester} / 현재 상태: {row.accessMode}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLock(row.psrNo);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  row.accessMode === "승인"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-300 text-slate-700"
                }`}
              >
                {row.accessMode === "승인" ? "승인" : "잠금"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-medium">선택 PSR 상세 검토 정보</h3>
        {selected ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">{selected.psrNo}</span> · {selected.title}
            </p>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">컬럼 리스트</p>
              <div className="flex flex-wrap gap-2">
                {(selected.reviewedColumns?.length
                  ? selected.reviewedColumns
                  : ["CUSTOMER_ID", "COL_A", "COL_B"]
                ).map((col) => (
                  <span key={col} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {selected.status === "산출 완료" ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">데이터 미리보기 (Top 10)</p>
                    <p className="text-xs text-slate-500">
                      {selected.psrNo} · 스냅샷 시점: {selected.snapshotAt ?? "-"}
                    </p>
                  </div>
                  <Button size="sm" onClick={loadRealtime} disabled={loadingRealtime}>
                    {loadingRealtime ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        실시간 조회 중...
                      </span>
                    ) : (
                      "실시간 전체 데이터 조회"
                    )}
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {columnMeta.map((col) => (
                          <th key={col.name} className="px-3 py-2 text-left font-medium">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="border-t border-slate-100">
                          {columnMeta.map((col) => (
                            <td key={col.name} className="px-3 py-2">
                              {String(row[col.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {fullRows ? (
                  <div className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-indigo-900">실시간 전체 데이터 조회 결과</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={exportXlsx}>
                          Excel (.xlsx)
                        </Button>
                        <Button size="sm" variant="outline" onClick={exportCsv}>
                          CSV
                        </Button>
                        <Button size="sm" variant="outline" onClick={exportTxt}>
                          TXT
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600">총 {fullTotal.toLocaleString()}건 조회됨</p>
                    {fullTotal > 1000 ? (
                      <p className="text-xs text-amber-700">
                        데이터가 너무 많아 상위 1000개까지만 표시됩니다. 전체 데이터는 다운로드 기능을 이용하세요.
                      </p>
                    ) : null}
                    <div
                      className={
                        fullTotal >= 100
                          ? "max-h-[360px] overflow-auto rounded-md border border-slate-200 bg-white"
                          : "rounded-md border border-slate-200 bg-white"
                      }
                    >
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            {columnMeta.map((col) => (
                              <th key={col.name} className="px-3 py-2 text-left font-medium">
                                {col.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map((row, idx) => (
                            <tr key={idx} className="border-t border-slate-100">
                              {columnMeta.map((col) => (
                                <td key={col.name} className="px-3 py-2">
                                  {String(row[col.name])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                산출 완료 상태의 PSR를 선택하면 데이터 미리보기 기능을 사용할 수 있습니다.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            상단 또는 하단 리스트에서 PSR 항목을 선택하면 컬럼 리스트를 확인할 수 있습니다.
          </p>
        )}
      </div>
    </section>
  );
}
