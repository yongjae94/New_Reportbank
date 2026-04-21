"use client";

import { AlertTriangle, Clock3, FileBarChart2, Layers3 } from "lucide-react";

const cards = [
  { title: "전체 산출 건수", value: "1,284", desc: "이번 달 팀 쿼리 실행", icon: FileBarChart2 },
  { title: "승인 대기", value: "17", desc: "보안담당자 결재 필요", icon: Clock3, danger: true },
  { title: "민감정보(PII) 탐지", value: "9", desc: "최근 7일 자동 차단", icon: AlertTriangle, warn: true },
  { title: "팀별 리소스", value: "42", desc: "활성 쿼리 템플릿", icon: Layers3 },
];

export function StatsCards() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-sm text-slate-500">{card.title}</p>
              <Icon className={`h-4 w-4 ${card.danger ? "text-red-500" : card.warn ? "text-amber-500" : "text-indigo-500"}`} />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{card.value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.desc}</p>
          </div>
        );
      })}
    </div>
  );
}
