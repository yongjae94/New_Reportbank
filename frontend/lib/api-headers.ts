import { getAccessToken } from "@/lib/auth-storage";
import { CURRENT_USER } from "@/lib/report-templates";

/** API 요청 헤더: 로그인 시 Bearer, 없으면 개발용 X-* 헤더. */
export function apiHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const t = getAccessToken();
  if (t) {
    h.Authorization = `Bearer ${t}`;
    return h;
  }
  h["X-User-Id"] = CURRENT_USER.userId;
  h["X-Team-Id"] = CURRENT_USER.department.toLowerCase();
  h["X-User-Role"] = CURRENT_USER.role;
  return h;
}
