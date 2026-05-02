const TOKEN_KEY = "reportbank_access_token";
const PROFILE_KEY = "reportbank_auth_profile";

export type StoredAuthProfile = {
  userId: string;
  loginId: string;
  displayName: string | null;
  teamId: string | null;
  groupId: string;
  platformAdmin: boolean;
  dbaMenu: boolean;
  /** 조회·수정 중 하나라도 허용된 관리자 메뉴 page_key (백엔드 카탈로그 키) */
  adminMenuPages?: string[];
  /** DBA 메뉴 page_key */
  dbaMenuPages?: string[];
};

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredProfile(): StoredAuthProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuthProfile;
  } catch {
    return null;
  }
}

export function persistSession(token: string, profile: StoredAuthProfile): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
}
