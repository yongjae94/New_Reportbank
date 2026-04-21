"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PiiBadge } from "@/components/dashboard/pii-badge";

type DictRow = {
  owner: string;
  table_name: string;
  column_name: string;
  pii_type: string;
  risk_level: "High" | "Medium" | "Low" | string;
};

export function MetadataDictionary({ apiBase }: { apiBase: string }) {
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<DictRow[]>([]);

  const search = async () => {
    const q = keyword ? `?keyword=${encodeURIComponent(keyword)}` : "";
    const resp = await fetch(`${apiBase}/v1/dashboard/meta-dictionary${q}`, {
      headers: {
        "X-User-Id": "admin",
        "X-Team-Id": "platform",
      },
    });
    const data = (await resp.json()) as DictRow[];
    setRows(data);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          placeholder="테이블/컬럼/PII 타입 검색"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Button size="sm" onClick={() => void search()}>
          검색
        </Button>
      </div>
      <div className="rounded-md border border-neutral-300 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-left">Table</th>
              <th className="px-3 py-2 text-left">Column</th>
              <th className="px-3 py-2 text-left">PII</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${r.table_name}-${r.column_name}-${idx}`} className="border-t border-neutral-200">
                <td className="px-3 py-2">{r.owner}</td>
                <td className="px-3 py-2">{r.table_name}</td>
                <td className="px-3 py-2">{r.column_name}</td>
                <td className="px-3 py-2">
                  <PiiBadge label={r.pii_type} risk={r.risk_level} />
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-neutral-500" colSpan={4}>
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
