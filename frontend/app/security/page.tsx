export default function SecuritySettingsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">보안 설정</h1>
        <p className="mt-1 text-sm text-slate-600">팀 권한, PII 정책, 마스킹 정책을 관리합니다.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium">권한 정책</h3>
          <p className="mt-1 text-xs text-slate-500">Casbin role/domain 설정 미리보기</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium">PII 차단 정책</h3>
          <p className="mt-1 text-xs text-slate-500">High/Medium/Low별 차단/승인 플로우</p>
        </div>
      </div>
    </section>
  );
}
