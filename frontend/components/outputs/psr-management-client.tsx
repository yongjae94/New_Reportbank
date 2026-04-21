"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { getPsrRecords, type PsrRecord } from "@/lib/psr-store";

type DataRow = Record<string, string | number>;

type ColumnMeta = {
  name: string;
  type: string;
};

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

function statusClass(status: PsrRecord["status"]): string {
  if (status === "산출 완료") return "bg-emerald-100 text-emerald-700";
  if (status === "결재중") return "bg-amber-100 text-amber-700";
  if (status === "정보보호 승인대기") return "bg-blue-100 text-blue-700";
  if (status === "조회 기간 만료") {
    return "text-slate-700 bg-[repeating-linear-gradient(-45deg,#e5e7eb_0px,#e5e7eb_6px,#f3f4f6_6px,#f3f4f6_12px)]";
  }
  return "bg-red-100 text-red-700";
}

export function PsrManagementClient() {
  const [psrList, setPsrList] = useState<PsrRecord[]>([]);
  const [selected, setSelected] = useState<PsrRecord | null>(null);
  const [notice, setNotice] = useState<string>("");
  const [loadingRealtime, setLoadingRealtime] = useState(false);
  const [fullRows, setFullRows] = useState<DataRow[] | null>(null);
  const [fullTotal, setFullTotal] = useState<number>(0);

  useEffect(() => {
    setPsrList(getPsrRecords());
  }, []);

  const previewRows = selected ? snapshotRowsByPsr[selected.psrNo] ?? [] : [];
  const displayRows = useMemo(() => {
    if (!fullRows) return [];
    return fullRows.slice(0, 1000);
  }, [fullRows]);

  const clickPsr = (row: PsrRecord) => {
    setFullRows(null);
    setFullTotal(0);
    if (row.status !== "산출 완료") {
      setSelected(null);
      setNotice("산출 완료 상태의 PSR만 상세 데이터 조회가 가능합니다.");
      return;
    }
    if (row.accessMode === "잠금") {
      setSelected(null);
      setNotice("정보보호 담당자가 잠금 처리하여 현재 조회할 수 없습니다.");
      return;
    }
    setNotice("");
    setSelected(row);
  };

  const loadRealtime = async () => {
    if (!selected) return;
    setLoadingRealtime(true);
    setNotice("");
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
    downloadTextFile("psr-data.csv", `${header}\n${body}`, "text/csv;charset=utf-8;");
  };

  const exportTxt = () => {
    if (!displayRows.length) return;
    const header = Object.keys(displayRows[0]).join("\t");
    const body = displayRows.map((r) => Object.values(r).join("\t")).join("\n");
    downloadTextFile("psr-data.txt", `${header}\n${body}`, "text/plain;charset=utf-8;");
  };

  const exportXlsx = () => {
    if (!displayRows.length) return;
    const ws = XLSX.utils.json_to_sheet(displayRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PSR_DATA");
    XLSX.writeFile(wb, "psr-data.xlsx");
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
                <th className="px-3 py-2 text-left">요청 제목</th>
                <th className="px-3 py-2 text-left">요청자</th>
                <th className="px-3 py-2 text-left">요청일</th>
                <th className="px-3 py-2 text-left">조회 가능 기간</th>
                <th className="px-3 py-2 text-left">진행 상태</th>
              </tr>
            </thead>
            <tbody>
              {psrList.map((row) => (
                <tr
                  key={row.psrNo}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  onClick={() => clickPsr(row)}
                >
                  <td className="px-3 py-2 font-medium text-indigo-700">{row.psrNo}</td>
                  <td className="px-3 py-2">{row.title}</td>
                  <td className="px-3 py-2">{row.requester}</td>
                  <td className="px-3 py-2">{row.requestedAt}</td>
                  <td className="px-3 py-2">{row.viewableUntil ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(row.status)}`}>
                      {row.status}
                    </span>
                    {row.accessMode === "잠금" ? (
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">데이터 미리보기 (Top 10)</h3>
              <p className="text-xs text-slate-500">
                {selected.psrNo} · 스냅샷 시점: {selected.snapshotAt ?? "-"}
              </p>
            </div>
            <Button onClick={loadRealtime} disabled={loadingRealtime}>
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

          <div className="rounded-md border border-slate-200 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">컬럼 메타데이터</p>
            <div className="flex flex-wrap gap-2">
              {columnMeta.map((col) => (
                <span key={col.name} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                  {col.name} ({col.type})
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
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
            <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-medium text-indigo-900">실시간 전체 데이터 조회 결과</h4>
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

              <div className={fullTotal >= 100 ? "max-h-[520px] overflow-auto rounded-md border border-slate-200 bg-white" : "rounded-md border border-slate-200 bg-white"}>
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
      ) : null}
    </section>
  );
}
