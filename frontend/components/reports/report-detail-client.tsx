"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CURRENT_USER, type ReportTemplate } from "@/lib/report-templates";
import { getReportAccessMap, subscribeReportAccess, type ReportAccessState } from "@/lib/report-access-store";

type Row = Record<string, string | number>;

function bindSql(sqlTemplate: string, values: Record<string, string>) {
  return sqlTemplate.replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) => {
    const v = values[key] ?? "";
    return `'${v.replaceAll("'", "''")}'`;
  });
}

function makeResultRows(count: number, values: Record<string, string>): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    close_ym: values.closeYm || values.baseDate || "202604",
    dept_cd: values.deptCode || "PLATFORM",
    emp_no: values.empNo || `2026${String(i + 1).padStart(4, "0")}`,
    user_id: values.userId || "admin",
    amount: 10000 + i * 73,
  }));
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportDetailClient({ report }: { report: ReportTemplate }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showQuery, setShowQuery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [reportStates, setReportStates] = useState<ReportAccessState[]>([]);

  useEffect(() => {
    setReportStates(Object.values(getReportAccessMap()));
    return subscribeReportAccess((next) => setReportStates(next));
  }, []);

  const sqlPreview = useMemo(() => bindSql(report.sqlTemplate, values), [report.sqlTemplate, values]);
  const renderedRows = useMemo(() => rows.slice(0, 1000), [rows]);
  const accessMode = useMemo(() => {
    const row = reportStates.find((x) => x.reportId === report.id);
    return row?.accessMode ?? "승인";
  }, [report.id, reportStates]);
  const isLocked = accessMode === "잠금";

  const runReport = async () => {
    if (isLocked) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1100));
    const total = report.id === "monthly-closing" ? 1320 : 240;
    setTotalRows(total);
    setRows(makeResultRows(total, values));
    setLoading(false);
  };

  const exportCsv = () => {
    if (!renderedRows.length) return;
    const header = Object.keys(renderedRows[0]).join(",");
    const body = renderedRows
      .map((r) => Object.values(r).map((v) => `"${String(v).replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");
    downloadTextFile(`${report.id}.csv`, `${header}\n${body}`, "text/csv;charset=utf-8;");
  };
  const exportTxt = () => {
    if (!renderedRows.length) return;
    const header = Object.keys(renderedRows[0]).join("\t");
    const body = renderedRows.map((r) => Object.values(r).join("\t")).join("\n");
    downloadTextFile(`${report.id}.txt`, `${header}\n${body}`, "text/plain;charset=utf-8;");
  };
  const exportXlsx = () => {
    if (!renderedRows.length) return;
    const ws = XLSX.utils.json_to_sheet(renderedRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "REPORT_RESULT");
    XLSX.writeFile(wb, `${report.id}.xlsx`);
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{report.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{report.description}</p>
        </div>
        <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50" href="/reports">
          뒤로가기
        </Link>
      </div>

      {isLocked ? (
        <div className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm text-slate-700">
          이 레포트는 승인 관리함에서 잠금 처리되어 실행할 수 없습니다.
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-medium">변수 입력</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {report.variables.map((v) => (
            <div key={v.key} className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{v.label}</label>
              {v.type === "select" ? (
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={values[v.key] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v.key]: e.target.value }))}
                >
                  <option value="">선택</option>
                  {(v.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={v.type === "date" ? "date" : "text"}
                  placeholder={v.placeholder}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={values[v.key] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={runReport} disabled={loading || isLocked}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                실행 중...
              </span>
            ) : (
              "실행"
            )}
          </Button>
          <Button variant="outline" onClick={() => setShowQuery((v) => !v)} disabled={isLocked}>
            쿼리 보기
          </Button>
        </div>

        {showQuery ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">실행 SQL (Read-only)</p>
            <textarea
              className="h-40 w-full resize-none rounded-md border border-slate-300 bg-white p-2 font-mono text-xs"
              value={sqlPreview}
              readOnly
            />
          </div>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">실행 결과</h3>
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
          <p className="text-xs text-slate-600">총 {totalRows.toLocaleString()}건 조회됨</p>
          {totalRows > 1000 ? (
            <p className="text-xs text-amber-700">
              데이터가 너무 많아 상위 1000개까지만 표시됩니다. 전체 데이터는 다운로드하세요.
            </p>
          ) : null}
          <div
            className={
              renderedRows.length > 100
                ? "max-h-[520px] overflow-auto rounded-md border border-slate-200"
                : "rounded-md border border-slate-200"
            }
          >
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {Object.keys(renderedRows[0] ?? {}).map((k) => (
                    <th key={k} className="px-3 py-2 text-left font-medium">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renderedRows.map((r, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    {Object.keys(r).map((k) => (
                      <td key={k} className="px-3 py-2">
                        {String(r[k])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <p className="text-xs text-slate-500">
        백엔드 연동 시 입력 변수는 API로 전달되어 서버에 저장된 SQL 템플릿에 바인딩되어 실행됩니다. (현재는 목업 실행)
      </p>
      <p className="text-xs text-slate-500">
        현재 사용자 부서: <span className="font-medium text-indigo-700">{CURRENT_USER.department}</span>
      </p>
    </section>
  );
}
