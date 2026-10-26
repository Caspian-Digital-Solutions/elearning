"use client";

import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import type { LearnerSkillCard } from "@/lib/skills/queries";
import { useMemo, useState } from "react";

export function SkillsCatalogueScreen({
  skills,
  departments,
  defaultStatus,
}: {
  skills: LearnerSkillCard[];
  departments: { id: string; name: string }[];
  defaultStatus: string;
}) {
  const [departmentId, setDepartmentId] = useState("all");
  const [status, setStatus] = useState(defaultStatus);

  const filtered = useMemo(() => {
    const statusMap: Record<string, string> = {
      live: "Live",
      approved: "Approved",
      retired: "Retired",
    };
    return skills.filter((row) => {
      if (departmentId !== "all" && row.departmentId !== departmentId) {
        return false;
      }
      if (status !== "all" && row.status !== statusMap[status]) {
        return false;
      }
      return true;
    });
  }, [skills, departmentId, status]);

  const rows = filtered.map((row) => ({
    ...row,
    linkName: row.name,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="skill-dept">Department</Label>
          <NativeSelect
            id="skill-dept"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            <option value="all">All departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="skill-status">Status</Label>
          <NativeSelect id="skill-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="live">Live</option>
            <option value="approved">Approved</option>
            <option value="retired">Retired</option>
            <option value="all">All visible</option>
          </NativeSelect>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No Skills yet" description="Live Skills appear here once trainers publish them." />
      ) : (
        <DataTable
          rowKey="name"
          columns={[
            { key: "displayName", header: "Skill" },
            { key: "department", header: "Department" },
            { key: "owner", header: "Owner" },
            { key: "version", header: "Version" },
            { key: "status", header: "Status" },
            { key: "liveSinceLabel", header: "Live", wrap: true },
          ]}
          rows={rows}
          caption="Skills catalogue"
          exportFileName="skills.csv"
          rowActions={(row) => (
            <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/skills/${row.name}`}>
              View
            </Link>
          )}
        />
      )}
    </div>
  );
}
