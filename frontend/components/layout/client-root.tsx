"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/components/auth/auth-context";
import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";

function RoutedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <>{children}</>;
  }
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RoutedShell>{children}</RoutedShell>
    </AuthProvider>
  );
}
