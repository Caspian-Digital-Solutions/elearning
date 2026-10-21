"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { TrainerPlanView } from "@/lib/plan/queries";
import type { PlanStatus } from "@/lib/plan/types";
import { fetchTrainerPlan, overridePlanItem, rebuildLearnerPlan } from "./plan-actions";

type PlanRow = {
  moduleId: string;
  code: string;
  status: string;
  dueWeek: string;
  dueDate: string;
  done: string;
  reason: string;
  setBy: string;
  override: string;
};

const statusLabels: Record<PlanStatus, string> = {
  required: "Required",
  optional: "Optional",
  tested_out: "Tested out",
  bridge: "Bridge",
  not_applicable: "Not applicable",
};

const columns: DataColumn<PlanRow>[] = [
  { key: "code", header: "Module" },
  { key: "status", header: "Status" },
  { key: "dueWeek", header: "Due week" },
  { key: "dueDate", header: "Due date" },
  { key: "done", header: "Done" },
  { key: "reason", header: "Reason", wrap: true },
  { key: "setBy", header: "Set by" },
  { key: "override", header: "Override" },
];

export function PersonPlanTab({ userId, streamSet }: { userId: string; streamSet: boolean }) {
  const [plan, setPlan] = useState<TrainerPlanView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<PlanStatus>("required");
  const [reason, setReason] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const data = await fetchTrainerPlan(userId);
      setPlan(data);
    });
  }, [userId]);

  function reload() {
    startTransition(async () => {
      const data = await fetchTrainerPlan(userId);
      setPlan(data);
    });
  }

  function runRebuild() {
    startTransition(async () => {
      const result = await rebuildLearnerPlan(userId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Plan rebuilt (${result.data.rows} modules). Overrides kept.`);
      setRebuildOpen(false);
      reload();
    });
  }

  function runOverride() {
    if (!editingModuleId) {
      return;
    }
    setOverrideError(null);
    startTransition(async () => {
      const result = await overridePlanItem({
        userId,
        moduleId: editingModuleId,
        status: newStatus,
        reason,
      });
      if (!result.ok) {
        setOverrideError(result.error);
        return;
      }
      toast.success("Plan row updated.");
      setEditingModuleId(null);
      setReason("");
      reload();
    });
  }

  if (!streamSet) {
    return <p className="text-sm text-muted-foreground">Set a stream before a learning plan can be built.</p>;
  }

  if (!plan && pending) {
    return <p className="text-sm text-muted-foreground">Loading plan…</p>;
  }

  if (!plan?.hasPlan) {
    return (
      <div className="space-y-3 text-sm">
        <p>No plan rows yet. Confirm Week 0 placement or rebuild the plan.</p>
        <Button type="button" size="sm" disabled={pending} onClick={() => setRebuildOpen(true)}>
          Rebuild plan
        </Button>
        <ConfirmDialog
          open={rebuildOpen}
          onOpenChange={setRebuildOpen}
          title="Rebuild learning plan?"
          description="Regenerates modules from stream, bridges and settings. Manual overrides are kept."
          confirmLabel="Rebuild plan"
          onConfirm={runRebuild}
          pending={pending}
        />
        <FormError>{error}</FormError>
      </div>
    );
  }

  const rows: PlanRow[] = plan.rows.map((row) => ({
    moduleId: row.moduleId,
    code: `${row.code} — ${row.title}`,
    status: statusLabels[row.status],
    dueWeek: row.dueWeek !== null ? String(row.dueWeek) : "—",
    dueDate: row.dueDateLabel?.replace("Due ", "") ?? "—",
    done: row.done ? "Yes" : "No",
    reason: row.overrideReason ?? row.reason ?? "—",
    setBy: row.setByName ?? "—",
    override: row.isOverride ? "Yes" : "—",
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setRebuildOpen(true)}>
          Rebuild plan
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey="moduleId"
        caption={`Learning plan for ${plan.personName}`}
        exportFileName={`plan-${userId}.csv`}
        rowActions={(row) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingModuleId(row.moduleId);
              setOverrideError(null);
            }}
          >
            Change status
          </Button>
        )}
      />

      {editingModuleId ? (
        <div className="space-y-3 rounded-lg border p-3 text-sm">
          <h3 className="font-medium">Change module status</h3>
          <FormError>{overrideError}</FormError>
          <div className="space-y-1">
            <Label>Status</Label>
            <NativeSelect value={newStatus} onChange={(event) => setNewStatus(event.target.value as PlanStatus)}>
              {(Object.keys(statusLabels) as PlanStatus[]).map((status) => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label>Reason (at least ten characters)</Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setEditingModuleId(null)}>Cancel</Button>
            <Button type="button" disabled={pending} onClick={runOverride}>Save override</Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={rebuildOpen}
        onOpenChange={setRebuildOpen}
        title="Rebuild learning plan?"
        description="Regenerates modules from stream, bridges and settings. Manual overrides are kept."
        confirmLabel="Rebuild plan"
        onConfirm={runRebuild}
        pending={pending}
      />
    </div>
  );
}
