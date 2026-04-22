"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPsrRecords, savePsrRecords, subscribePsrRecords, type PsrRecord } from "@/lib/psr-store";
import { REPORT_TEMPLATES } from "@/lib/report-templates";
import {
  getReportAccessMap,
  setReportAccessMode,
  subscribeReportAccess,
  type ReportAccessState,
} from "@/lib/report-access-store";
import { PsrDataPreviewPanel } from "@/components/psr/psr-data-preview-panel";
import {
  ApprovalCategorySelector,
  type ApprovalCategory,
} from "@/components/approvals/approval-category-selector";
import { ReportApprovalList } from "@/components/approvals/report-approval-list";

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

export default function ApprovalsPage() {
  const [rows, setRows] = useState<PsrRecord[]>([]);
  const [selectedPsrNo, setSelectedPsrNo] = useState<string | null>(null);
  const [reportStates, setReportStates] = useState<ReportAccessState[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [category, setCategory] = useState<ApprovalCategory>("psr");
  const [switchLoading, setSwitchLoading] = useState(false);

  useEffect(() => {
    setRows(getPsrRecords());
    return subscribePsrRecords((next) => setRows(next));
  }, []);

  useEffect(() => {
    setReportStates(Object.values(getReportAccessMap()));
    return subscribeReportAccess((next) => setReportStates(next));
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
  const reportStateMap = useMemo(
    () =>
      reportStates.reduce<Record<string, ReportAccessState>>((acc, item) => {
        acc[item.reportId] = item;
        return acc;
      }, {}),
    [reportStates]
  );
  const manageableReports = useMemo(
    () =>
      REPORT_TEMPLATES.map((report) => ({
        ...report,
        accessMode: reportStateMap[report.id]?.accessMode ?? "승인",
      })),
    [reportStateMap]
  );
  const selectedReport = useMemo(
    () => manageableReports.find((r) => r.id === selectedReportId) ?? null,
    [manageableReports, selectedReportId]
  );

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

  const toggleReportAccess = (reportId: string) => {
    const currentMode = reportStateMap[reportId]?.accessMode ?? "승인";
    const nextMode = currentMode === "승인" ? "잠금" : "승인";
    setReportAccessMode(reportId, nextMode);
  };

  const changeCategory = (next: ApprovalCategory) => {
    if (next === category) return;
    setSwitchLoading(true);
    window.setTimeout(() => {
      setCategory(next);
      setSwitchLoading(false);
    }, 280);
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
                onClick={() => {
                  setSelectedPsrNo(row.psrNo);
                }}
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
        <h3 className="mb-3 font-medium">관리 대상 선택</h3>
        <ApprovalCategorySelector value={category} onChange={changeCategory} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-medium">
          {category === "psr" ? "PSR 산출물 관리 목록" : "팀별 레포트 관리 목록"}
        </h3>
        {switchLoading ? (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            항목을 불러오는 중입니다...
          </div>
        ) : category === "psr" ? (
          <div className="space-y-2">
            {completed.map((row) => (
              <div
                key={row.psrNo}
                className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                  selectedPsrNo === row.psrNo ? "border-indigo-300 bg-indigo-50" : "border-slate-200"
                }`}
                onClick={() => {
                  setSelectedPsrNo(row.psrNo);
                }}
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
        ) : (
          <ReportApprovalList
            rows={manageableReports}
            selectedReportId={selectedReportId}
            onSelect={(reportId) => {
              setSelectedReportId(reportId);
            }}
            onToggle={toggleReportAccess}
          />
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-medium">상세 검토 정보</h3>
        {category === "psr" && selected ? (
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
              <PsrDataPreviewPanel
                selected={selected}
                filePrefix="psr-approval-data"
                tableMaxHeightClass="max-h-[360px]"
              />
            ) : (
              <p className="text-xs text-slate-500">
                산출 완료 상태의 PSR를 선택하면 데이터 미리보기 기능을 사용할 수 있습니다.
              </p>
            )}
          </div>
        ) : null}

        {category === "report" && selectedReport ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">{selectedReport.title}</p>
            <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 md:grid-cols-2">
              <p>접근 부서: {selectedReport.allowedDepartments.join(", ")}</p>
              <p>현재 공개 상태: {selectedReport.accessMode}</p>
              <p>마지막 수정일: {selectedReport.lastExecutedAt}</p>
              <p>주요 변수: {selectedReport.variableGuide}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-500">쿼리 내용 (Read-only)</p>
              <pre className="overflow-auto whitespace-pre-wrap text-xs text-slate-700">
                {selectedReport.sqlTemplate}
              </pre>
            </div>
            <p className="text-xs text-slate-500">
              잠금 상태로 전환하면 팀별 레포트 메뉴에서 목록 노출이 차단되고 직접 URL 접근 시에도 실행할 수 없습니다.
            </p>
          </div>
        ) : null}

        {category === "psr" && !selected ? (
          <p className="text-sm text-slate-500">
            상단 또는 하단 리스트에서 PSR 항목을 선택하면 컬럼 리스트를 확인할 수 있습니다.
          </p>
        ) : null}

        {category === "report" && !selectedReport ? (
          <p className="text-sm text-slate-500">
            팀별 레포트 목록에서 항목을 선택하면 쿼리 내용과 접근 메타데이터를 확인할 수 있습니다.
          </p>
        ) : (
          null
        )}
      </div>
    </section>
  );
}
