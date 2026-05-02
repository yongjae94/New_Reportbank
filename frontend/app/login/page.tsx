"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { token, ready, login } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const nextPath = useMemo(() => {
    const n = params.get("next");
    if (n && n.startsWith("/") && !n.startsWith("//")) return n;
    return "/dashboard";
  }, [params]);

  useEffect(() => {
    if (!ready) return;
    if (token) router.replace(nextPath);
  }, [ready, token, router, nextPath]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(loginId.trim(), password);
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 실패");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <h1 className="text-center text-xl font-semibold text-white">ReportBank 로그인</h1>
        <p className="mt-1 text-center text-xs text-slate-400">세션 만료: 300분 (백엔드 JWT 설정)</p>
        <form className="mt-6 space-y-3" onSubmit={submit}>
          <div>
            <label className="text-xs text-slate-400">로그인 ID</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">비밀번호</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
          <Button type="submit" className="w-full bg-indigo-600 text-white hover:bg-indigo-500">
            로그인
          </Button>
        </form>
      </div>
    </div>
  );
}
