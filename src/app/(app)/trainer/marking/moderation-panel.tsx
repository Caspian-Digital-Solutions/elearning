"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { ModerationRow } from "@/lib/assignments/queries";
import { assignDoubleMarks } from "@/app/(app)/trainer/marking/marking-actions";

export function ModerationPanel({
  rows,
  assignmentOptions,
}: {
  rows: ModerationRow[];
  assignmentOptions: { id: string; label: string }[];
}) {
  const [assignmentId, setAssignmentId] = useState(assignmentOptions[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const tableRows = useMemo(
    () =>
      rows.map((row) => ({
        submissionId: row.submissionId,
        personName: row.personName,
        department: row.department,
        moduleCode: row.moduleCode,
        assignmentTitle: row.assignmentTitle,
        attemptNo: String(row.attemptNo),
        primaryTotal: row.primaryTotal !== null ? String(row.primaryTotal) : "—",
        doubleTotal: row.doubleTotal !== null ? String(row.doubleTotal) : "—",
        differencePct: row.differencePct !== null ? `${row.differencePct}%` : "—",
        finalRequired: row.finalRequired ? "Yes" : "No",
        released: row.released ? "Yes" : "No",
      })),
    [rows],
  );

  const runAssign = () => {
    if (!assignmentId) {
      return;
    }
    startTransition(async () => {
      const result = await assignDoubleMarks(assignmentId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Double-marks assigned.");
      window.location.reload();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Assignment</Label>
          <NativeSelect value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
            {assignmentOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </NativeSelect>
        </div>
        <Button type="button" disabled={pending || !assignmentId} onClick={runAssign}>
          Assign double-marks
        </Button>
      </div>

      <DataTable
        rowKey="submissionId"
        caption="Moderation"
        exportFileName="assignment-moderation.csv"
        columns={[
          { key: "personName", header: "Person" },
          { key: "department", header: "Department" },
          { key: "moduleCode", header: "Module" },
          { key: "assignmentTitle", header: "Assignment" },
          { key: "attemptNo", header: "Attempt" },
          { key: "primaryTotal", header: "Primary" },
          { key: "doubleTotal", header: "Double" },
          { key: "differencePct", header: "Difference" },
          { key: "finalRequired", header: "Final needed" },
          { key: "released", header: "Released" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
