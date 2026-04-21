"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PiiBadge } from "@/components/dashboard/pii-badge";
import { QueryPreviewModal } from "@/components/dashboard/query-preview-modal";

type Row = {
  id: string;
  status: string;
  sql_preview: string;
  sql_text?: string;
  pii_items: Array<{ name: string; risk: "High" | "Medium" | "Low" | string }>;
};

export function ApprovalQueue({
  rows,
  isApprover,
  apiBase,
}: {
  rows: Row[];
  isApprover: boolean;
  apiBase: string;
}) {
  const [message, setMessage] = useState<string>("");

  if (!isApprover) {
    return <div className="rounded-md border border-neutral-300 bg-white p-4 text-sm">승인권자(보안담당자/팀장)만 접근 가능합니다.</div>;
  }

  const decide = async (id: string, approved: boolean) => {
    const resp = await fetch(`${apiBase}/v1/dashboard/approvals/${id}/decision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "admin",
        "X-Team-Id": "platform",
      },
      body: JSON.stringify({ approved, comment: approved ? "승인" : "반려" }),
    });
    const data = await resp.json();
    setMessage(
      `Mock Data Guard 적용: ${JSON.stringify((data.sample_preview ?? []).slice(0, 1))}`
    );
  };

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-md border border-neutral-300 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">{row.id}</span>
            <span className="text-xs text-neutral-500">{row.status}</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            {row.pii_items.map((p, i) => (
              <PiiBadge key={`${p.name}-${i}`} label={p.name} risk={p.risk} />
            ))}
          </div>
          <div className="mb-3">
            <QueryPreviewModal sql={row.sql_text ?? row.sql_preview} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void decide(row.id, true)}>
              승인
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void decide(row.id, false)}>
              반려
            </Button>
          </div>
        </div>
      ))}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
    </div>
  );
}
