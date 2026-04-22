"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CURRENT_USER, getAllowedReports } from "@/lib/report-templates";
import { getReportAccessMap, subscribeReportAccess, type ReportAccessState } from "@/lib/report-access-store";

export function ReportsListClient() {
  const [reportStates, setReportStates] = useState<ReportAccessState[]>([]);

  useEffect(() => {
    setReportStates(Object.values(getReportAccessMap()));
    return subscribeReportAccess((next) => setReportStates(next));
  }, []);

  const reportStateMap = useMemo(
    () =>
      reportStates.reduce<Record<string, ReportAccessState>>((acc, item) => {
        acc[item.reportId] = item;
        return acc;
      }, {}),
    [reportStates]
  );
  const reports = useMemo(
    () =>
      getAllowedReports(CURRENT_USER.department).filter(
        (report) => (reportStateMap[report.id]?.accessMode ?? "승인") === "승인"
      ),
    [reportStateMap]
  );

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">팀별 레포트</h1>
        <p className="mt-1 text-sm text-slate-600">
          부서 권한(RBAC)에 따라 실행 가능한 정해진 쿼리 템플릿만 표시됩니다.
        </p>
      </div>
      <p className="text-xs text-slate-500">
        현재 사용자: <span className="font-medium text-slate-700">{CURRENT_USER.userId}</span> / 부서:{" "}
        <span className="font-medium text-indigo-700">{CURRENT_USER.department}</span>
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <Link
            key={report.id}
            href={`/reports/${report.id}`}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/30"
          >
            <h3 className="font-medium">{report.title}</h3>
            <p className="mt-1 text-xs text-slate-600">{report.description}</p>
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <p>마지막 실행일: {report.lastExecutedAt}</p>
              <p>주요 변수: {report.variableGuide}</p>
            </div>
          </Link>
        ))}
      </div>
      {!reports.length ? (
        <p className="text-sm text-slate-500">
          현재 부서에서 열람 가능한 레포트가 없거나 승인 관리함에서 잠금 처리되었습니다.
        </p>
      ) : null}
    </section>
  );
}
