import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-600 to-slate-900 p-6 text-white shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight">ReportBank Security Portal</h1>
        <p className="mt-2 text-sm text-indigo-100">데이터 보안과 거버넌스를 위한 통합 운영 포털</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Link
          className="rounded-lg border border-slate-300 bg-white p-4 text-sm hover:bg-slate-50"
          href="/dashboard"
        >
          대시보드 홈
        </Link>
        <Link
          className="rounded-lg border border-slate-300 bg-white p-4 text-sm hover:bg-slate-50"
          href="/outputs"
        >
          쿼리 요청/이력
        </Link>
        <Link
          className="rounded-lg border border-slate-300 bg-white p-4 text-sm hover:bg-slate-50"
          href="/approvals"
        >
          승인 관리함
        </Link>
        <Link
          className="rounded-lg border border-slate-300 bg-white p-4 text-sm hover:bg-slate-50"
          href="/metadata"
        >
          메타데이터 탐색기
        </Link>
        <Link
          className="rounded-lg border border-slate-300 bg-white p-4 text-sm hover:bg-slate-50"
          href="/reports"
        >
          팀별 레포트
        </Link>
        <Link
          className="rounded-lg border border-slate-300 bg-white p-4 text-sm hover:bg-slate-50"
          href="/security"
        >
          보안 설정
        </Link>
      </div>
    </section>
  );
}
