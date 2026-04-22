"use client";

import type { ReportTemplate } from "@/lib/report-templates";
import type { ReportAccessMode } from "@/lib/report-access-store";

type ReportListItem = ReportTemplate & {
  accessMode: ReportAccessMode;
};

export function ReportApprovalList({
  rows,
  selectedReportId,
  onSelect,
  onToggle,
}: {
  rows: ReportListItem[];
  selectedReportId: string | null;
  onSelect: (reportId: string) => void;
  onToggle: (reportId: string) => void;
}) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">현재 관리 가능한 팀 레포트가 없습니다.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.id}
          className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
            selectedReportId === row.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200"
          }`}
          onClick={() => onSelect(row.id)}
        >
          <div>
            <p className="text-sm font-medium">{row.title}</p>
            <p className="text-xs text-slate-500">
              접근 부서: {row.allowedDepartments.join(", ")} / 마지막 수정일: {row.lastExecutedAt}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(row.id);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              row.accessMode === "승인" ? "bg-emerald-100 text-emerald-700" : "bg-slate-300 text-slate-700"
            }`}
          >
            {row.accessMode === "승인" ? "승인" : "잠금"}
          </button>
        </div>
      ))}
    </div>
  );
}
