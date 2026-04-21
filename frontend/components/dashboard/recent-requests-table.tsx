"use client";

import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { PiiBadge } from "@/components/dashboard/pii-badge";

type Row = {
  requester: string;
  summary: string;
  pii: Array<{ name: string; risk: "High" | "Medium" | "Low" }>;
  status: "승인완료" | "대기" | "반려";
  requestedAt: string;
};

const data: Row[] = [
  {
    requester: "kim.dev",
    summary: "고객 식별 컬럼 포함 주문 현황 조회",
    pii: [{ name: "주민번호", risk: "High" }, { name: "성명", risk: "Medium" }],
    status: "대기",
    requestedAt: "2026-04-21 10:22",
  },
  {
    requester: "lee.ops",
    summary: "월간 손익 통계 집계",
    pii: [],
    status: "승인완료",
    requestedAt: "2026-04-21 09:10",
  },
  {
    requester: "park.data",
    summary: "고객 연락처 정합성 점검",
    pii: [{ name: "성명", risk: "Medium" }],
    status: "반려",
    requestedAt: "2026-04-20 18:02",
  },
];

export function RecentRequestsTable() {
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "requester", header: "요청자" },
    { accessorKey: "summary", header: "쿼리 요약" },
    {
      accessorKey: "pii",
      header: "PII 여부",
      cell: ({ row }) =>
        row.original.pii.length ? (
          <div className="flex flex-wrap gap-1">
            {row.original.pii.map((p) => (
              <PiiBadge key={`${p.name}-${p.risk}`} label={p.name} risk={p.risk} />
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-500">없음</span>
        ),
    },
    {
      accessorKey: "status",
      header: "상태",
      cell: ({ row }) => (
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{row.original.status}</span>
      ),
    },
    { accessorKey: "requestedAt", header: "요청 일시" },
  ];
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-medium">최근 산출 요청 이력</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            {table.getHeaderGroups().map((h) => (
              <tr key={h.id}>
                {h.headers.map((x) => (
                  <th key={x.id} className="px-3 py-2 text-left font-medium text-slate-600">
                    {x.isPlaceholder ? null : flexRender(x.column.columnDef.header, x.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className="px-3 py-2">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
