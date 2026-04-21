export default function ReportsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">팀별 레포트</h1>
        <p className="mt-1 text-sm text-slate-600">팀 공유 레포트 템플릿과 실행 이력을 확인합니다.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {["민감정보 접근 통계", "요청/승인 리드타임", "팀별 쿼리 자산 현황"].map((x) => (
          <div key={x} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-medium">{x}</h3>
            <p className="mt-1 text-xs text-slate-500">팀 레포트 카드 (목업)</p>
          </div>
        ))}
      </div>
    </section>
  );
}
