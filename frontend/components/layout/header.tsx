"use client";

import { Bell, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/layout/command-palette";

export function Header() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <header className="border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="w-full max-w-md">
          <CommandPalette />
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100">
            <Bell className="h-4 w-4" />
          </button>
          <button
            className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setDark((v) => !v)}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="rounded-md bg-slate-100 px-3 py-1.5 text-sm">
            접속자 <span className="font-semibold text-indigo-700">admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
