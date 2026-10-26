"use client";

import { DataTable } from "@/components/shared/data-table";
import type { DepartmentCertificationRow } from "@/lib/skills/queries";

export function SkillCertificationPanel({ rows }: { rows: DepartmentCertificationRow[] }) {
  return (
    <DataTable
      rowKey="skillName"
      columns={[
        { key: "department", header: "Department" },
        { key: "displayName", header: "Certification Skill" },
        { key: "status", header: "Status" },
        { key: "owner", header: "Owner" },
        { key: "liveSince", header: "Live since" },
        { key: "evidenceSummary", header: "Evidence", wrap: true },
      ]}
      rows={rows}
      caption="Department certification evidence"
      exportFileName="skill-certification-evidence.csv"
    />
  );
}
