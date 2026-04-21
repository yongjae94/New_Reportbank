import { QuickReports } from "@/components/dashboard/quick-reports";
import { RecentRequestsTable } from "@/components/dashboard/recent-requests-table";
import { StatsCards } from "@/components/dashboard/stats-cards";

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">데이터 보안 및 거버넌스 포털</h1>
        <p className="mt-1 text-sm text-slate-600">팀 기반 쿼리 거버넌스 현황과 주요 활동을 한눈에 확인하세요.</p>
      </div>
      <StatsCards />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <RecentRequestsTable />
        </div>
        <div className="xl:col-span-2">
          <QuickReports />
        </div>
      </div>
    </section>
  );
}
