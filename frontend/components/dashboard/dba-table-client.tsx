"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { apiHeaders } from "@/lib/api-headers";

type Job = {
  id: string;
  psr_number: string;
  status: string;
  sql_text: string;
  target_db_kind: string;
  pii_summary: {
    pii_columns?: Array<{ schema?: string; table?: string; column?: string }>;
  };
  performance_notes?: string | null;
};

export function DbaTableClient() {
  const [rows, setRows] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api",
    []
  );

  const load = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const resp = await fetch(`${apiBase}/workflow/jobs/pending-dba`, { headers: apiHeaders() });
      if (!resp.ok) throw new Error(await resp.text());
      const data = (await resp.json()) as Job[];
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const approve = async (id: string) => {
    await fetch(`${apiBase}/workflow/jobs/${id}/approve`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ dba_user: "dba.user" }),
    });
    await load();
  };

  const reject = async (id: string) => {
    await fetch(`${apiBase}/workflow/jobs/${id}/reject`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ dba_user: "dba.user", reason: "manual review reject" }),
    });
    await load();
  };

  const columns = useMemo<ColumnDef<Job>[]>(
    () => [
      { accessorKey: "psr_number", header: "PSR" },
      { accessorKey: "target_db_kind", header: "Target DB" },
      { accessorKey: "status", header: "Status" },
      {
        id: "pii",
        header: "PII 경고",
        cell: ({ row }) => (
          <span className="text-xs text-amber-700">
            {(row.original.pii_summary?.pii_columns ?? []).length} columns
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void approve(row.original.id)}>
              승인
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void reject(row.original.id)}>
              반려
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  if (loading) return <div className="p-6 text-sm">불러오는 중...</div>;
  if (error) return <div className="p-6 text-sm text-red-700">{error}</div>;

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <h1 className="mb-4 text-xl font-semibold">DBA Audit Dashboard</h1>
      <div className="overflow-x-auto rounded-md border border-neutral-300 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2 text-left font-medium">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
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
    </div>
  );
}
