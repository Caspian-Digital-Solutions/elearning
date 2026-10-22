"use client";

import Link from "next/link";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import type { LearnerAssignmentListRow } from "@/lib/assignments/queries";

export function AssignmentsScreen({ rows }: { rows: LearnerAssignmentListRow[] }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        purpose="Module assignments on your learning path. Due dates come from your plan."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="When your trainer publishes assignments for modules on your plan, they appear here."
        />
      ) : (
        <DataTable
          rowKey="id"
          caption="Your assignments"
          exportFileName="assignments.csv"
          columns={[
            { key: "moduleCode", header: "Module" },
            { key: "title", header: "Assignment" },
            { key: "dueLabel", header: "Due" },
            { key: "statusLabel", header: "Status" },
            { key: "markLabel", header: "Mark" },
          ]}
          rows={rows.map((row) => ({
            id: row.id,
            moduleCode: row.moduleCode,
            title: row.title,
            dueLabel: row.dueLabel ?? "—",
            statusLabel: row.statusLabel,
            markLabel: row.markLabel ?? "—",
            href: row.href,
          }))}
          filters={[
            { key: "moduleCode", label: "Module" },
            { key: "statusLabel", label: "Status" },
          ]}
          rowActions={(row) => (
            <Button size="sm" variant="outline" render={<Link href={row.href} />}>Open</Button>
          )}
        />
      )}
    </div>
  );
}
