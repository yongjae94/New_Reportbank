"use client";

import { REPORT_TEMPLATES } from "@/lib/report-templates";

export type ReportAccessMode = "승인" | "잠금";
export type ReportAccessState = {
  reportId: string;
  accessMode: ReportAccessMode;
  updatedAt: string;
};

const STORAGE_KEY = "reportbank.report.access.v1";
const SYNC_EVENT = "reportbank:report-access-updated";

function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

const seed: ReportAccessState[] = REPORT_TEMPLATES.map((r) => ({
  reportId: r.id,
  accessMode: "승인",
  updatedAt: r.lastExecutedAt,
}));

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getReportAccessStates(): ReportAccessState[] {
  if (!canUseStorage()) return seed;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw) as ReportAccessState[];
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
}

export function getReportAccessMap(): Record<string, ReportAccessState> {
  const states = getReportAccessStates();
  return states.reduce<Record<string, ReportAccessState>>((acc, item) => {
    acc[item.reportId] = item;
    return acc;
  }, {});
}

export function setReportAccessMode(reportId: string, mode: ReportAccessMode) {
  if (!canUseStorage()) return;
  const current = getReportAccessStates();
  const hasItem = current.some((x) => x.reportId === reportId);
  const next = hasItem
    ? current.map((x) =>
        x.reportId === reportId ? { ...x, accessMode: mode, updatedAt: nowStamp() } : x
      )
    : [...current, { reportId, accessMode: mode, updatedAt: nowStamp() }];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

export function subscribeReportAccess(onChange: (rows: ReportAccessState[]) => void) {
  if (!canUseStorage()) return () => {};
  const sync = () => onChange(getReportAccessStates());
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) sync();
  };
  const onCustom = () => sync();
  window.addEventListener("storage", onStorage);
  window.addEventListener(SYNC_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SYNC_EVENT, onCustom);
  };
}
