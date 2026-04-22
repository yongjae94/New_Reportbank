"use client";

type ApprovalCategory = "psr" | "report";

const CATEGORY_OPTIONS: Array<{
  key: ApprovalCategory;
  label: string;
  description: string;
}> = [
  {
    key: "psr",
    label: "PSR 산출물 관리",
    description: "산출 완료 PSR의 공개/잠금을 제어합니다.",
  },
  {
    key: "report",
    label: "팀별 레포트 관리",
    description: "템플릿 레포트의 열람 권한을 관리합니다.",
  },
];

export function ApprovalCategorySelector({
  value,
  onChange,
}: {
  value: ApprovalCategory;
  onChange: (next: ApprovalCategory) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {CATEGORY_OPTIONS.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`rounded-xl border p-4 text-left transition ${
              active
                ? "border-indigo-300 bg-indigo-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
            }`}
          >
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="mt-1 text-xs text-slate-600">{item.description}</p>
          </button>
        );
      })}
    </div>
  );
}

export type { ApprovalCategory };
