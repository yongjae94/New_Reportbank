"use client";

import { useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { apiHeaders } from "@/lib/api-headers";

type SubmitState = { loading: boolean; result?: { job_id: string }; error?: string };

const DEFAULT_SQL = `SELECT EMP_NO, EMP_NM\nFROM HR.EMPLOYEE\nWHERE ROWNUM <= 100;`;

export function SqlEditorClient() {
  const [psrNumber, setPsrNumber] = useState("");
  const [targetDbKind, setTargetDbKind] = useState("oracle");
  const [sqlText, setSqlText] = useState(DEFAULT_SQL);
  const [state, setState] = useState<SubmitState>({ loading: false });

  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api",
    []
  );

  const onFileUpload: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".sql")) {
      setState({ loading: false, error: ".sql 파일만 업로드할 수 있습니다." });
      return;
    }
    const content = await file.text();
    setSqlText(content);
    setState({ loading: false });
  };

  const submit = async () => {
    setState({ loading: true });
    try {
      const resp = await fetch(`${apiBase}/itsm/webhook`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          psr_number: psrNumber,
          sql_text: sqlText,
          target_db_kind: targetDbKind,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = (await resp.json()) as { job_id: string };
      setState({ loading: false, result: data });
    } catch (err) {
      setState({ loading: false, error: err instanceof Error ? err.message : "등록 실패" });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">SQL IDE</h1>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          className="rounded-md border border-neutral-300 bg-white px-3 py-2"
          placeholder="PSR 번호"
          value={psrNumber}
          onChange={(e) => setPsrNumber(e.target.value)}
        />
        <select
          className="rounded-md border border-neutral-300 bg-white px-3 py-2"
          value={targetDbKind}
          onChange={(e) => setTargetDbKind(e.target.value)}
        >
          <option value="oracle">Oracle</option>
          <option value="mssql">SQL Server</option>
          <option value="postgres">PostgreSQL</option>
        </select>
        <input className="rounded-md border border-neutral-300 bg-white px-3 py-2" type="file" accept=".sql" onChange={onFileUpload} />
      </div>
      <div className="overflow-hidden rounded-md border border-neutral-300 bg-white">
        <Editor
          height="420px"
          language="sql"
          value={sqlText}
          onChange={(v) => setSqlText(v ?? "")}
          options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on" }}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={state.loading || !psrNumber || !sqlText} onClick={submit}>
          {state.loading ? "등록 중..." : "워크플로 등록"}
        </Button>
        {state.result ? <span className="text-sm text-emerald-700">등록 완료: {state.result.job_id}</span> : null}
        {state.error ? <span className="text-sm text-red-700">{state.error}</span> : null}
      </div>
    </div>
  );
}
