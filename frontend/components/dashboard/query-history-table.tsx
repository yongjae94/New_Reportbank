"use client";

import { useMemo } from "react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { PiiBadge } from "@/components/dashboard/pii-badge";
import { QueryPreviewModal } from "@/components/dashboard/query-preview-modal";

export type DashboardQueryRow = {
  id: string;
  status: string;
  created_at: string;
  risk_level: string;
  pii_items: Array<{ name: string; risk: "High" | "Medium" | "Low" | string }>;
  sql_preview: string;
  sql_text?: string;
};

export function QueryHistoryTable({ rows }: { rows: DashboardQueryRow[] }) {
  const columns = useMemo<ColumnDef<DashboardQueryRow>[]>(
    () => [
      { accessorKey: "id", header: "요청ID" },
      { accessorKey: "status", header: "상태" },
      {
        accessorKey: "pii_items",
        header: "PII 탐지",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.pii_items.length === 0 ? (
              <span className="text-xs text-neutral-500">없음</span>
            ) : (
              row.original.pii_items.map((p, i) => <PiiBadge key={`${p.name}-${i}`} label={p.name} risk={p.risk} />)
            )}
          </div>
        ),
      },
      {
        accessorKey: "risk_level",
        header: "위험도",
      },
      {
        accessorKey: "created_at",
        header: "요청일시",
      },
      {
        id: "preview",
        header: "미리보기",
        cell: ({ row }) => (
          <QueryPreviewModal sql={row.original.sql_text ?? row.original.sql_preview} />
        ),
      },
    ],
    []
  );
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-300 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-neutral-100">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="px-3 py-2 text-left font-medium">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t border-neutral-200">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
