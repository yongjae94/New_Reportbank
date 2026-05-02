import type { StoredAuthProfile } from "@/lib/auth-storage";

/** 서버가 내려준 admin_menu_pages 기준. 없으면(구 세션) platformAdmin이면 전체 관리자 메뉴로 간주 */
export function canShowAdminPageKey(profile: StoredAuthProfile | null, pageKey: string): boolean {
  if (!profile) return false;
  const pages = profile.adminMenuPages;
  if (pages != null && pages.length > 0) return pages.includes(pageKey);
  return profile.platformAdmin === true;
}

export function canShowDbaPageKey(profile: StoredAuthProfile | null, pageKey: string): boolean {
  if (!profile) return false;
  const pages = profile.dbaMenuPages;
  if (pages != null && pages.length > 0) return pages.includes(pageKey);
  return profile.dbaMenu === true;
}
