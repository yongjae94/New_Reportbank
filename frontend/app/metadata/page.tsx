export default function MetadataPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">메타데이터 탐색기</h1>
        <p className="mt-1 text-sm text-slate-600">사내 DB/테이블/컬럼의 PII 등록 현황을 검색합니다.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex gap-2">
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="DB, 테이블, 컬럼 검색"
          />
          <button className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white">검색</button>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">DB</p>
            <p className="mt-1 font-medium">RPT</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">TABLE</p>
            <p className="mt-1 font-medium">CUSTOMER</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-xs text-slate-500">COLUMN</p>
            <p className="mt-1 font-medium text-red-600">RRN (High)</p>
          </div>
        </div>
      </div>
    </section>
  );
}
