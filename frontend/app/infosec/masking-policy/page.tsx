"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiHeaders } from "@/lib/api-headers";

type MaskPolicy = {
  policy_id: string;
  policy_name: string;
  transform_key: "RRN" | "PHONE" | "NAME" | "NAME_KO" | "NAME_EN" | "ADDRESS";
  use_yn: "Y" | "N";
};

export default function MaskingPolicyPage() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api", []);
  const [rows, setRows] = useState<MaskPolicy[]>([]);
  const [name, setName] = useState("");
  const [transform, setTransform] = useState<MaskPolicy["transform_key"]>("RRN");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void load().catch((e) => {
      setNotice(e instanceof Error ? e.message : "마스킹 정책 조회 실패");
    });
  }, []);

  const load = async () => {
    try {
      const resp = await fetch(`${apiBase}/v1/security/mask-policies`, { headers: apiHeaders() });
      if (!resp.ok) throw new Error(await resp.text());
      setRows((await resp.json()) as MaskPolicy[]);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "마스킹 정책 조회 실패");
    }
  };

  const createPolicy = async () => {
    setNotice("");
    try {
      const resp = await fetch(`${apiBase}/v1/security/mask-policies`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ policy_name: name, transform_key: transform, use_yn: "Y" }),
      });
      if (!resp.ok) {
        setNotice(await resp.text());
        return;
      }
      setName("");
      await load();
      setNotice("마스킹 정책이 등록되었습니다.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "마스킹 정책 등록 실패");
    }
  };

  const toggleUse = async (row: MaskPolicy) => {
    try {
      const resp = await fetch(`${apiBase}/v1/security/mask-policies/${row.policy_id}`, {
        method: "PUT",
        headers: apiHeaders(),
        body: JSON.stringify({
          policy_name: row.policy_name,
          transform_key: row.transform_key,
          use_yn: row.use_yn === "Y" ? "N" : "Y",
        }),
      });
      if (!resp.ok) {
        setNotice(await resp.text());
        return;
      }
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "마스킹 정책 수정 실패");
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">마스킹 정책</h1>
        <p className="mt-1 text-sm text-slate-600">정보보호 담당자가 정책명과 변조 로직 매핑을 관리합니다.</p>
      </div>
      {notice ? <p className="text-xs text-amber-700">{notice}</p> : null}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-medium">마스킹 정책 등록</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_auto]">
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="정책명 예: 주민등록번호 정책"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={transform}
            onChange={(e) => setTransform(e.target.value as MaskPolicy["transform_key"])}
          >
            <option value="RRN">RRN</option>
            <option value="PHONE">PHONE</option>
            <option value="ADDRESS">ADDRESS</option>
            <option value="NAME">NAME</option>
            <option value="NAME_KO">NAME_KO (성명 한글)</option>
            <option value="NAME_EN">NAME_EN (성명 영문)</option>
          </select>
          <Button onClick={() => void createPolicy()} disabled={!name.trim()}>
            등록
          </Button>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-medium">마스킹 정책 목록</h3>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.policy_id} className="flex items-center justify-between rounded-md border border-slate-200 p-2">
              <p className="text-sm">
                {row.policy_name} <span className="text-xs text-slate-500">({row.transform_key})</span>
              </p>
              <Button size="sm" variant="outline" onClick={() => void toggleUse(row)}>
                {row.use_yn === "Y" ? "사용중" : "미사용"}
              </Button>
            </div>
          ))}
          {!rows.length ? <p className="text-sm text-slate-500">등록된 정책이 없습니다.</p> : null}
        </div>
      </div>
    </section>
  );
}
