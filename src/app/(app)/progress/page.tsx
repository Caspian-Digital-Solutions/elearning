import type { Metadata } from "next";
import { sections } from "@/config/navigation";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { sampleProgressRows, type ProgressRow } from "@/lib/sample-progress";

export const metadata: Metadata = {
  title: "Progress",
};

const columns: DataColumn<ProgressRow>[] = [
  { key: "person", header: "Person" },
  { key: "department", header: "Department" },
  { key: "lessons", header: "Lessons completed" },
  { key: "assessments", header: "Assessments completed" },
  { key: "assignments", header: "Assignments submitted" },
];

export default function ProgressPage() {
  const section = sections.progress;

  return (
    <>
      <PageHeader title={section.title} purpose={section.purpose} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge>Sample data</StatusBadge>
        <p className="text-sm text-muted-foreground">
          Built in Prompt 10. These rows are not real staff.
        </p>
      </div>
      <DataTable
        columns={columns}
        rows={sampleProgressRows}
        caption="Sample data"
        exportFileName="progress-sample.csv"
      />
    </>
  );
}
