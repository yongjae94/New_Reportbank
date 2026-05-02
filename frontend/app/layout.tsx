import type { Metadata } from "next";
import { ClientRoot } from "@/components/layout/client-root";
import "./globals.css";

export const metadata: Metadata = {
  title: "Report Bank",
  description: "Integrated SQL governance and report output platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
