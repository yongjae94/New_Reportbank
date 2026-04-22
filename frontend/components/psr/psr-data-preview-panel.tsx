"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { type PsrRecord } from "@/lib/psr-store";

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

export function PsrDataPreviewPanel({
  selected,
  filePrefix,
  tableMaxHeightClass = "max-h-[520px]",
}: {
  selected: PsrRecord;
  filePrefix: string;
  tableMaxHeightClass?: string;
}) {
  const [loadingRealtime, setLoadingRealtime] = useState(false);
  const [fullRows, setFullRows] = useState<DataRow[] | null>(null);
  const [fullTotal, setFullTotal] = useState<number>(0);

  useEffect(() => {
    // Critical: reset stale result when PSR selection changes
    setFullRows(null);
    setFullTotal(0);
    setLoadingRealtime(false);
  }, [selected.psrNo]);

  const previewRows = snapshotRowsByPsr[selected.psrNo] ?? [];
  const displayRows = useMemo(() => (fullRows ? fullRows.slice(0, 1000) : []), [fullRows]);

  const loadRealtime = async () => {
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
    downloadTextFile(`${filePrefix}.csv`, `${header}\n${body}`, "text/csv;charset=utf-8;");
  };

  const exportTxt = () => {
    if (!displayRows.length) return;
    const header = Object.keys(displayRows[0]).join("\t");
    const body = displayRows.map((r) => Object.values(r).join("\t")).join("\n");
    downloadTextFile(`${filePrefix}.txt`, `${header}\n${body}`, "text/plain;charset=utf-8;");
  };

  const exportXlsx = () => {
    if (!displayRows.length) return;
    const ws = XLSX.utils.json_to_sheet(displayRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PSR_DATA");
    XLSX.writeFile(wb, `${filePrefix}.xlsx`);
  };

  return (
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

      <div className="rounded-md border border-slate-200 p-3 bg-white">
        <p className="mb-2 text-xs font-medium text-slate-500">컬럼 메타데이터</p>
        <div className="flex flex-wrap gap-2">
          {columnMeta.map((col) => (
            <span key={col.name} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
              {col.name} ({col.type})
            </span>
          ))}
        </div>
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
                ? `${tableMaxHeightClass} overflow-auto rounded-md border border-slate-200 bg-white`
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
  );
}
