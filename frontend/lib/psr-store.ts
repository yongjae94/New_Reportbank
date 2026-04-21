"use client";

export type PsrStatus = "결재중" | "정보보호 승인대기" | "산출 완료" | "반려" | "조회 기간 만료";
export type AccessMode = "승인" | "잠금";

export type PsrRecord = {
  psrNo: string;
  title: string;
  requester: string;
  requestedAt: string;
  viewableUntil?: string;
  status: PsrStatus;
  snapshotAt?: string;
  accessMode: AccessMode;
  reviewedColumns?: string[];
};

const STORAGE_KEY = "reportbank.psr.records.v1";

const seed: PsrRecord[] = [
  {
    psrNo: "PSR-2026-1001",
    title: "고객 기본정보 산출",
    requester: "kim.dev",
    requestedAt: "2026-04-18",
    viewableUntil: "2026-05-18 23:59:59",
    status: "산출 완료",
    snapshotAt: "2026-04-18 14:22:36",
    accessMode: "승인",
    reviewedColumns: ["CUSTOMER_ID", "CUSTOMER_NAME", "GRADE", "SIGNUP_AT"],
  },
  {
    psrNo: "PSR-2026-1002",
    title: "월간 주문 통계 산출",
    requester: "lee.ops",
    requestedAt: "2026-04-19",
    viewableUntil: "-",
    status: "정보보호 승인대기",
    accessMode: "잠금",
    reviewedColumns: ["ORDER_ID", "ORDER_DT", "CUSTOMER_TIER", "AMOUNT"],
  },
  {
    psrNo: "PSR-2026-1003",
    title: "채널별 리텐션 데이터",
    requester: "park.data",
    requestedAt: "2026-04-20",
    viewableUntil: "-",
    status: "반려",
    accessMode: "잠금",
    reviewedColumns: ["USER_ID", "CHANNEL_ID", "RETENTION_SCORE"],
  },
  {
    psrNo: "PSR-2026-1004",
    title: "휴면 고객 목록",
    requester: "choi.biz",
    requestedAt: "2026-04-21",
    viewableUntil: "2026-05-21 23:59:59",
    status: "산출 완료",
    snapshotAt: "2026-04-21 09:05:12",
    accessMode: "승인",
    reviewedColumns: ["CUSTOMER_ID", "LAST_LOGIN_AT", "DORMANT_YN"],
  },
  {
    psrNo: "PSR-2026-1005",
    title: "장기 미접속 사용자 목록",
    requester: "seo.pm",
    requestedAt: "2026-04-22",
    viewableUntil: "2026-04-30 23:59:59",
    status: "조회 기간 만료",
    accessMode: "잠금",
    reviewedColumns: ["USER_ID", "LAST_ACCESS_AT", "LOCK_REASON"],
  },
];

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getPsrRecords(): PsrRecord[] {
  if (!canUseStorage()) return seed;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  try {
    const parsed = JSON.parse(raw) as PsrRecord[];
    return parsed;
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
}

export function savePsrRecords(rows: PsrRecord[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}
