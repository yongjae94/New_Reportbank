"use client";

import { useEffect, useState } from "react";
import { getPsrRecords, subscribePsrRecords, type PsrRecord } from "@/lib/psr-store";
import { PsrDataPreviewPanel } from "@/components/psr/psr-data-preview-panel";

function statusClass(status: PsrRecord["status"]): string {
  if (status === "산출 완료") return "bg-emerald-100 text-emerald-700";
  if (status === "결재중") return "bg-amber-100 text-amber-700";
  if (status === "정보보호 승인대기") return "bg-blue-100 text-blue-700";
  if (status === "조회 기간 만료") {
    return "text-slate-700 bg-[repeating-linear-gradient(-45deg,#e5e7eb_0px,#e5e7eb_6px,#f3f4f6_6px,#f3f4f6_12px)]";
  }
  return "bg-red-100 text-red-700";
}

export function PsrManagementClient() {
  const [psrList, setPsrList] = useState<PsrRecord[]>([]);
  const [selected, setSelected] = useState<PsrRecord | null>(null);
  const [notice, setNotice] = useState<string>("");

  useEffect(() => {
    setPsrList(getPsrRecords());
    return subscribePsrRecords((rows) => setPsrList(rows));
  }, []);

  const clickPsr = (row: PsrRecord) => {
    if (row.status !== "산출 완료") {
      setSelected(null);
      setNotice("산출 완료 상태의 PSR만 상세 데이터 조회가 가능합니다.");
      return;
    }
    if (row.accessMode === "잠금") {
      setSelected(null);
      setNotice("정보보호 담당자가 잠금 처리하여 현재 조회할 수 없습니다.");
      return;
    }
    setNotice("");
    setSelected(row);
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">PSR 산출</h1>
        <p className="mt-1 text-sm text-slate-600">
          PSR 요청 목록을 확인하고, 산출 완료 항목의 결과를 샘플 및 실시간 데이터로 조회합니다.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-medium">PSR 요청 리스트</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">PSR 번호</th>
                <th className="px-3 py-2 text-left">요청 제목</th>
                <th className="px-3 py-2 text-left">요청자</th>
                <th className="px-3 py-2 text-left">요청일</th>
                <th className="px-3 py-2 text-left">조회 가능 기간</th>
                <th className="px-3 py-2 text-left">진행 상태</th>
              </tr>
            </thead>
            <tbody>
              {psrList.map((row) => (
                <tr
                  key={row.psrNo}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  onClick={() => clickPsr(row)}
                >
                  <td className="px-3 py-2 font-medium text-indigo-700">{row.psrNo}</td>
                  <td className="px-3 py-2">{row.title}</td>
                  <td className="px-3 py-2">{row.requester}</td>
                  <td className="px-3 py-2">{row.requestedAt}</td>
                  <td className="px-3 py-2">{row.viewableUntil ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(row.status)}`}>
                      {row.status}
                    </span>
                    {row.accessMode === "잠금" ? (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">잠금</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {notice ? <p className="text-sm text-amber-700">{notice}</p> : null}

      {selected ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <PsrDataPreviewPanel selected={selected} filePrefix="psr-data" tableMaxHeightClass="max-h-[520px]" />
        </div>
      ) : null}
    </section>
  );
}
