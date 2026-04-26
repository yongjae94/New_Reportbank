"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPORT_TEMPLATES } from "@/lib/report-templates";
import {
  getReportAccessMap,
  setReportAccessMode,
  subscribeReportAccess,
  type ReportAccessState,
} from "@/lib/report-access-store";
import {
  ApprovalCategorySelector,
  type ApprovalCategory,
} from "@/components/approvals/approval-category-selector";
import { ReportApprovalList } from "@/components/approvals/report-approval-list";

type PsrFlow = {
  job_id: string;
  psr_number: string;
  status: string;
  sql_text: string;
  final_sql_text?: string | null;
  target_db_kind: string;
  executed_db_conn_id?: string | null;
  snapshot_rows: Array<Record<string, string | number>>;
  snapshot_columns: string[];
  requested_at?: string | null;
  viewable_until?: string | null;
  access_mode: string;
};

export default function ApprovalsPage() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api", []);
  const [pendingRows, setPendingRows] = useState<PsrFlow[]>([]);
  const [managedRows, setManagedRows] = useState<PsrFlow[]>([]);
  const [selectedPsrId, setSelectedPsrId] = useState<string | null>(null);
  const [reportStates, setReportStates] = useState<ReportAccessState[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [category, setCategory] = useState<ApprovalCategory>("psr");
  const [switchLoading, setSwitchLoading] = useState(false);
  const [pageNotice, setPageNotice] = useState<string>("");
  const [viewableDateEdit, setViewableDateEdit] = useState("");
  const [viewableHourEdit, setViewableHourEdit] = useState("00");
  const [viewableInitJobId, setViewableInitJobId] = useState<string | null>(null);
  const [returnChoiceJobId, setReturnChoiceJobId] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    void reloadPsrLists();
  }, []);

  useEffect(() => {
    setReportStates(Object.values(getReportAccessMap()));
    return subscribeReportAccess((next) => setReportStates(next));
  }, []);

  const pending = useMemo(() => pendingRows, [pendingRows]);
  const completed = useMemo(() => managedRows, [managedRows]);
  const selected = useMemo(
    () => [...pendingRows, ...managedRows].find((r) => r.job_id === selectedPsrId) ?? null,
    [pendingRows, managedRows, selectedPsrId]
  );

  useEffect(() => {
    // Initialize date/hour only when selecting a different PSR.
    // This prevents temporary list refreshes from clearing in-progress input.
    if (!selected?.job_id) return;
    if (viewableInitJobId === selected.job_id) return;

    if (selected.viewable_until) {
      const dt = new Date(selected.viewable_until);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const hh = String(dt.getHours()).padStart(2, "0");
      setViewableDateEdit(`${yyyy}-${mm}-${dd}`);
      setViewableHourEdit(hh);
    } else if (selected.requested_at) {
      const dt = new Date(selected.requested_at);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const hh = String(dt.getHours()).padStart(2, "0");
      setViewableDateEdit(`${yyyy}-${mm}-${dd}`);
      setViewableHourEdit(hh);
    } else {
      setViewableDateEdit("");
      setViewableHourEdit("00");
    }

    setViewableInitJobId(selected.job_id);
  }, [selected?.job_id, viewableInitJobId]);
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

  const approve = async (jobId: string) => {
    setPageNotice("");
    const resp = await fetch(`${apiBase}/v1/psr/${jobId}/infosec-approve`, { method: "POST" });
    if (!resp.ok) {
      setPageNotice(await resp.text());
      return;
    }
    await reloadPsrLists();
    setSelectedPsrId(jobId);
    setViewableInitJobId(null);
  };

  const returnPending = async (jobId: string, target: "dba" | "author") => {
    setPageNotice("");
    setReturning(true);
    try {
      const resp = await fetch(`${apiBase}/v1/psr/${jobId}/infosec-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          return_target: target,
          reason: target === "dba" ? "정보보호 담당자 반송" : "작성자 반송(ITSM 반영용 삭제)",
        }),
      });
      if (!resp.ok) {
        setPageNotice(await resp.text());
        return;
      }
      await reloadPsrLists();
      setSelectedPsrId(null);
      setViewableInitJobId(null);
      setReturnChoiceJobId(null);
      setPageNotice(target === "dba" ? "DBA로 반송되었습니다." : "작성자 반송 처리되어 목록에서 제거되었습니다.");
    } finally {
      setReturning(false);
    }
  };

  const toggleAccessMode = async (row: PsrFlow) => {
    setPageNotice("");
    const nextMode = row.access_mode === "승인" ? "잠금" : "승인";
    const resp = await fetch(`${apiBase}/v1/psr/${row.job_id}/access-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_mode: nextMode }),
    });
    if (!resp.ok) {
      setPageNotice(await resp.text());
      return;
    }
    await reloadPsrLists();
    setSelectedPsrId(row.job_id);
    setViewableInitJobId(null);
  };

  const saveViewableUntil = async () => {
    if (!selected) return;
    if (!isAfterStart(selected.requested_at, viewableDateEdit, viewableHourEdit)) {
      setPageNotice("조회 종료일은 조회 시작일보다 늦어야 합니다.");
      return;
    }
    setPageNotice("");
    const resp = await fetch(`${apiBase}/v1/psr/${selected.job_id}/viewable-until`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        viewable_until: buildViewableIso(viewableDateEdit, viewableHourEdit),
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      if (txt.includes("viewable_until_must_be_after_start")) {
        setPageNotice("조회 종료일은 조회 시작일보다 늦어야 합니다.");
        return;
      }
      setPageNotice(txt);
      return;
    }
    await reloadPsrLists();
    setSelectedPsrId(selected.job_id);
    setViewableInitJobId(null);
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
              <div key={row.job_id}>
                <div
                  className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                    selectedPsrId === row.job_id
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                  onClick={() => {
                    setSelectedPsrId(row.job_id);
                  }}
                >
                  <div>
                    <p className="text-sm font-medium">{row.psr_number}</p>
                    <p className="text-xs text-slate-500">
                      시작일: {row.requested_at ? row.requested_at.replace("T", " ").slice(0, 19) : "-"} / 종료일:{" "}
                      {row.viewable_until ? row.viewable_until.replace("T", " ").slice(0, 19) : "-"} / DB:{" "}
                      {row.target_db_kind}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void approve(row.job_id);
                      }}
                    >
                      승인
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReturnChoiceJobId((prev) => (prev === row.job_id ? null : row.job_id));
                      }}
                    >
                      반송
                    </Button>
                  </div>
                </div>
                {returnChoiceJobId === row.job_id ? (
                  <div
                    className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs text-amber-800">반송 대상을 선택하세요:</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={returning}
                      onClick={() => void returnPending(row.job_id, "dba")}
                    >
                      DBA 반송
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={returning}
                      onClick={() => void returnPending(row.job_id, "author")}
                    >
                      작성자 반송(삭제)
                    </Button>
                  </div>
                ) : null}
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
                key={row.job_id}
                className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                  selectedPsrId === row.job_id ? "border-indigo-300 bg-indigo-50" : "border-slate-200"
                }`}
                onClick={() => {
                  setSelectedPsrId(row.job_id);
                }}
              >
                <div>
                  <p className="text-sm font-medium">{row.psr_number}</p>
                  <p className="text-xs text-slate-500">
                    상태: 산출 완료 / 스냅샷: {row.snapshot_rows.length}건 / 시작일:{" "}
                    {row.requested_at ? row.requested_at.replace("T", " ").slice(0, 19) : "-"} / 종료일:{" "}
                    {row.viewable_until ? row.viewable_until.replace("T", " ").slice(0, 19) : "-"}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleAccessMode(row);
                  }}
                  className={`min-w-20 rounded-full px-3 py-1 text-xs font-semibold ${
                    row.access_mode === "승인"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-500 text-white shadow-sm"
                  }`}
                >
                  {row.access_mode === "승인" ? "승인 ON" : "잠금 ON"}
                </button>
              </div>
            ))}
            {!completed.length ? <p className="text-sm text-slate-500">현재 관리 가능한 산출 완료 PSR이 없습니다.</p> : null}
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
            <p className="text-sm font-medium">{selected.psr_number}</p>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">컬럼 리스트</p>
              <div className="flex flex-wrap gap-2">
                {(selected.snapshot_columns?.length ? selected.snapshot_columns : ["COL_1"]).map((col) => (
                  <span key={col} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {col}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-500">조회 가능 기간 설정 (정보보호담당자: 제한 없음)</p>
              <p className="mb-2 text-xs text-slate-600">
                시작일(고정): {selected.requested_at ? selected.requested_at.replace("T", " ").slice(0, 19) : "-"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={viewableDateEdit}
                  onChange={(e) => setViewableDateEdit(e.target.value)}
                />
                <select
                  className="w-24 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                  value={viewableHourEdit}
                  onChange={(e) => setViewableHourEdit(e.target.value)}
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
                <Button
                  size="sm"
                  onClick={() => void saveViewableUntil()}
                  disabled={!isAfterStart(selected.requested_at, viewableDateEdit, viewableHourEdit)}
                >
                  저장
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500">종료일은 시간 단위로 설정됩니다.</p>
            </div>

            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>{selected.snapshot_columns.map((c) => <th key={c} className="px-3 py-2 text-left">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {selected.snapshot_rows.map((r, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      {selected.snapshot_columns.map((c) => <td key={c} className="px-3 py-2">{String(r[c] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            상단 또는 하단 리스트에서 PSR 항목을 선택하면 스냅샷 Top10을 확인할 수 있습니다.
          </p>
        ) : null}

        {category === "report" && !selectedReport ? (
          <p className="text-sm text-slate-500">
            팀별 레포트 목록에서 항목을 선택하면 쿼리 내용과 접근 메타데이터를 확인할 수 있습니다.
          </p>
        ) : (
          null
        )}
        {pageNotice ? <p className="text-xs text-amber-700">{pageNotice}</p> : null}
      </div>
    </section>
  );

  async function reloadPsrLists() {
    try {
      const [pendingResp, managedResp] = await Promise.all([
        fetch(`${apiBase}/v1/psr/infosec-pending`),
        fetch(`${apiBase}/v1/psr/managed`),
      ]);
      if (!pendingResp.ok) throw new Error(await pendingResp.text());
      if (!managedResp.ok) throw new Error(await managedResp.text());
      setPendingRows((await pendingResp.json()) as PsrFlow[]);
      setManagedRows((await managedResp.json()) as PsrFlow[]);
    } catch (e) {
      setPageNotice(e instanceof Error ? e.message : "조회 실패");
    }
  }
}

function buildViewableIso(dateValue: string, hourValue: string): string | null {
  if (!dateValue) return null;
  const hour = hourValue || "00";
  const dt = new Date(`${dateValue}T${hour}:00:00`);
  return dt.toISOString();
}

function isAfterStart(
  startIso: string | null | undefined,
  endDateValue: string,
  endHourValue: string
): boolean {
  const endIso = buildViewableIso(endDateValue, endHourValue);
  if (!startIso || !endIso) return false;
  return new Date(endIso).getTime() > new Date(startIso).getTime();
}
