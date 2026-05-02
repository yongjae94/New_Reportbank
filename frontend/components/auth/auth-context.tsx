"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiHeaders } from "@/lib/api-headers";
import { clearSession, getAccessToken, getStoredProfile, persistSession, type StoredAuthProfile } from "@/lib/auth-storage";

type AuthContextValue = {
  token: string | null;
  profile: StoredAuthProfile | null;
  ready: boolean;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const apiBase = React.useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api", []);
  const [token, setToken] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<StoredAuthProfile | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useLayoutEffect(() => {
    const t = getAccessToken();
    const p = getStoredProfile();
    if (t && p) {
      setToken(t);
      setProfile(p);
    }
    setReady(true);
  }, []);

  const login = React.useCallback(
    async (loginId: string, password: string) => {
      const resp = await fetch(`${apiBase}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id: loginId, password }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "로그인에 실패했습니다.");
      }
      const data = (await resp.json()) as {
        access_token: string;
        platform_admin: boolean;
        dba_menu: boolean;
        admin_menu_pages?: string[];
        dba_menu_pages?: string[];
        user: {
          user_id: string;
          login_id: string;
          display_name: string | null;
          team_id: string | null;
          group_id: string;
        };
      };
      const prof: StoredAuthProfile = {
        userId: data.user.user_id,
        loginId: data.user.login_id,
        displayName: data.user.display_name,
        teamId: data.user.team_id,
        groupId: data.user.group_id,
        platformAdmin: data.platform_admin,
        dbaMenu: data.dba_menu,
        adminMenuPages: data.admin_menu_pages ?? [],
        dbaMenuPages: data.dba_menu_pages ?? [],
      };
      persistSession(data.access_token, prof);
      setToken(data.access_token);
      setProfile(prof);

      const me = await fetch(`${apiBase}/v1/auth/me`, { headers: apiHeaders() });
      if (me.ok) {
        const m = (await me.json()) as {
          platform_admin: boolean;
          dba_menu: boolean;
          admin_menu_pages?: string[];
          dba_menu_pages?: string[];
          display_name: string | null;
          team_id: string | null;
        };
        const merged: StoredAuthProfile = {
          ...prof,
          displayName: m.display_name,
          teamId: m.team_id,
          platformAdmin: m.platform_admin,
          dbaMenu: m.dba_menu,
          adminMenuPages: m.admin_menu_pages ?? prof.adminMenuPages,
          dbaMenuPages: m.dba_menu_pages ?? prof.dbaMenuPages,
        };
        persistSession(data.access_token, merged);
        setProfile(merged);
      }
    },
    [apiBase]
  );

  const logout = React.useCallback(() => {
    clearSession();
    setToken(null);
    setProfile(null);
    router.replace("/login");
  }, [router]);

  const value = React.useMemo(
    () => ({ token, profile, ready, login, logout }),
    [token, profile, ready, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = React.useContext(AuthContext);
  if (!v) throw new Error("useAuth는 AuthProvider 안에서만 사용하세요.");
  return v;
}
