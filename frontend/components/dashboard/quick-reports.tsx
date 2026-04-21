"use client";

import { Play } from "lucide-react";

const reports = [
  { name: "월간 거래 이상탐지 리포트", owner: "보안팀" },
  { name: "개인정보 접근 이력", owner: "개인정보보호팀" },
  { name: "승인 지연 요청 목록", owner: "플랫폼팀" },
  { name: "DBA 반려 사유 통계", owner: "데이터거버넌스팀" },
];

export function QuickReports() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-medium">자주 사용하는 팀 쿼리 레포트</h3>
      <div className="space-y-2">
        {reports.map((r) => (
          <button
            key={r.name}
            className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
          >
            <div>
              <p className="text-sm font-medium">{r.name}</p>
              <p className="text-xs text-slate-500">{r.owner}</p>
            </div>
            <Play className="h-4 w-4 text-indigo-600" />
          </button>
        ))}
      </div>
    </div>
  );
}
