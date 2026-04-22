export type DepartmentCode = "FIN" | "HR" | "PLATFORM" | "SEC";
export type VariableType = "date" | "select" | "text";

export type ReportVariable = {
  key: string;
  label: string;
  type: VariableType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export type ReportTemplate = {
  id: string;
  title: string;
  description: string;
  lastExecutedAt: string;
  variableGuide: string;
  allowedDepartments: DepartmentCode[];
  sqlTemplate: string;
  variables: ReportVariable[];
};

export const CURRENT_USER = {
  userId: "admin",
  department: "PLATFORM" as DepartmentCode,
  role: "DBA",
};

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "monthly-closing",
    title: "월마감 집계 보고서",
    description: "마감년월 기준 부서별 손익 집계 데이터를 조회합니다.",
    lastExecutedAt: "2026-04-20 18:30:10",
    variableGuide: "마감년월, 부서코드",
    allowedDepartments: ["FIN", "PLATFORM"],
    sqlTemplate:
      "SELECT close_ym, dept_cd, revenue, expense, profit FROM RPT.FIN_CLOSE WHERE close_ym = :closeYm AND dept_cd = :deptCode",
    variables: [
      { key: "closeYm", label: "마감년월", type: "text", required: true, placeholder: "YYYYMM" },
      {
        key: "deptCode",
        label: "부서코드",
        type: "select",
        required: true,
        options: [
          { value: "PLATFORM", label: "PLATFORM" },
          { value: "FIN", label: "FIN" },
          { value: "HR", label: "HR" },
        ],
      },
    ],
  },
  {
    id: "employee-report",
    title: "사번 기준 인사 현황 보고서",
    description: "사번/기준일자 기반 인사 정보를 조회합니다.",
    lastExecutedAt: "2026-04-21 09:05:44",
    variableGuide: "사번, 기준일자",
    allowedDepartments: ["HR", "PLATFORM"],
    sqlTemplate:
      "SELECT emp_no, emp_name, dept_cd, position, base_dt FROM RPT.HR_EMP_STATUS WHERE emp_no = :empNo AND base_dt = :baseDate",
    variables: [
      { key: "empNo", label: "사번", type: "text", required: true, placeholder: "예: 20260001" },
      { key: "baseDate", label: "기준일자", type: "date", required: true },
    ],
  },
  {
    id: "security-access",
    title: "민감정보 접근 이력 보고서",
    description: "조회기간 내 민감정보 접근 이력을 조회합니다.",
    lastExecutedAt: "2026-04-21 11:42:10",
    variableGuide: "조회 시작일, 조회 종료일, 사용자ID",
    allowedDepartments: ["SEC", "PLATFORM"],
    sqlTemplate:
      "SELECT access_dt, user_id, table_name, column_name, pii_risk FROM RPT.SEC_ACCESS_LOG WHERE access_dt BETWEEN :fromDate AND :toDate AND user_id = :userId",
    variables: [
      { key: "fromDate", label: "조회 시작일", type: "date", required: true },
      { key: "toDate", label: "조회 종료일", type: "date", required: true },
      { key: "userId", label: "사용자ID", type: "text", required: true, placeholder: "예: admin" },
    ],
  },
];

export function getAllowedReports(department: DepartmentCode) {
  return REPORT_TEMPLATES.filter((r) => r.allowedDepartments.includes(department));
}

export function getReportTemplateById(id: string) {
  return REPORT_TEMPLATES.find((r) => r.id === id) ?? null;
}
