import { notFound } from "next/navigation";
import { ReportDetailClient } from "@/components/reports/report-detail-client";
import { CURRENT_USER, getReportTemplateById } from "@/lib/report-templates";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const report = getReportTemplateById(reportId);
  if (!report) notFound();
  if (!report.allowedDepartments.includes(CURRENT_USER.department)) notFound();

  return <ReportDetailClient report={report} />;
}
