"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCalendarDate } from "@/lib/format";
import type { CohortRecord } from "@/lib/people/types";
import { deleteCohort, saveCohort, setCohortArchived } from "./actions";

type CohortRow = {
  id: string;
  name: string;
  startDate: string;
  startDateSort: string;
  slot: string;
  people: string;
  status: string;
  notes: string;
};

const columns: DataColumn<CohortRow>[] = [
  { key: "name", header: "Name" },
  { key: "startDate", header: "Start date", sortKey: "startDateSort" },
  { key: "slot", header: "Weekly slot" },
  { key: "people", header: "People" },
  { key: "status", header: "Status" },
  { key: "notes", header: "Notes", wrap: true },
];

export function CohortsPanel({
  cohorts,
  memberCounts,
}: {
  cohorts: CohortRecord[];
  memberCounts: Map<string, number>;
}) {
  const [editing, setEditing] = useState<CohortRecord | "new" | null>(null);
  const [deleting, setDeleting] = useState<CohortRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(cohorts.map((cohort) => [cohort.id, cohort])), [cohorts]);
  const rows = useMemo<CohortRow[]>(
    () =>
      cohorts.map((cohort) => ({
        id: cohort.id,
        name: cohort.name,
        startDate: formatCalendarDate(cohort.startDate),
        startDateSort: cohort.startDate ?? "",
        slot: cohort.slot ?? "",
        people: String(memberCounts.get(cohort.id) ?? 0),
        status: cohort.isArchived ? "Archived" : "Open",
        notes: cohort.notes ?? "",
      })),
    [cohorts, memberCounts],
  );

  function toggleArchived(cohort: CohortRecord) {
    startTransition(async () => {
      const result = await setCohortArchived(cohort.id, !cohort.isArchived);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(cohort.isArchived ? `${cohort.name} is open again.` : `${cohort.name} is archived.`);
    });
  }

  function confirmDelete() {
    if (!deleting) {
      return;
    }
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteCohort(deleting.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      toast.success(`${deleting.name} is deleted.`);
      setDeleting(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-muted-foreground">
          A cohort that has people in it cannot be deleted. Archive it instead: its people keep it, and no one new
          can join.
        </p>
        <Button type="button" onClick={() => setEditing("new")}>
          Create cohort
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey="id"
        caption="Cohorts. Archived cohorts are kept for the record."
        exportFileName="cds-ai-academy-cohorts.csv"
        filters={[{ key: "status", label: "Status", options: ["Open", "Archived"] }]}
        rowActions={(row) => {
          const cohort = byId.get(row.id);
          if (!cohort) {
            return null;
          }
          const inUse = (memberCounts.get(cohort.id) ?? 0) > 0;
          return (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(cohort)}>
                Edit<span className="sr-only"> {cohort.name}</span>
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => toggleArchived(cohort)}>
                {cohort.isArchived ? "Reopen" : "Archive"}
                <span className="sr-only"> {cohort.name}</span>
              </Button>
              {inUse ? null : (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleting(cohort);
                  }}
                >
                  Delete<span className="sr-only"> {cohort.name}</span>
                </Button>
              )}
            </div>
          );
        }}
        emptyMessage="No cohorts yet. Trainers create cohorts here, then add people from the People tab."
      />

      <CohortDialog cohort={editing} onClose={() => setEditing(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && !pending && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "this cohort"}?`}
        description="No one is in this cohort. Deleting it cannot be undone; the audit log keeps a record."
        confirmLabel="Delete cohort"
        onConfirm={confirmDelete}
        pending={pending}
        closeOnConfirm={false}
      >
        <FormError>{deleteError}</FormError>
      </ConfirmDialog>
    </div>
  );
}

function CohortDialog({ cohort, onClose }: { cohort: CohortRecord | "new" | null; onClose: () => void }) {
  return (
    <Dialog open={cohort !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {cohort ? (
          <CohortForm key={cohort === "new" ? "new" : cohort.id} cohort={cohort === "new" ? null : cohort} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CohortForm({ cohort, onClose }: { cohort: CohortRecord | null; onClose: () => void }) {
  const id = useId();
  const [name, setName] = useState(cohort?.name ?? "");
  const [startDate, setStartDate] = useState(cohort?.startDate ?? "");
  const [slot, setSlot] = useState(cohort?.slot ?? "");
  const [notes, setNotes] = useState(cohort?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!name.trim()) {
      setNameError("Give the cohort a name.");
      setError("The cohort was not saved. Check the name.");
      return;
    }
    setNameError(null);
    setError(null);
    startTransition(async () => {
      const result = await saveCohort({ id: cohort?.id, name, startDate, slot, notes });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(cohort ? `Saved ${name.trim()}.` : `Created ${name.trim()}.`);
      onClose();
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <DialogHeader>
        <DialogTitle>{cohort ? `Edit ${cohort.name}` : "Create cohort"}</DialogTitle>
        <DialogDescription>Name, start date and weekly slot. Add people to it from the People tab.</DialogDescription>
      </DialogHeader>
      <FormError>{error}</FormError>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          value={name}
          maxLength={100}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${id}-name-error` : undefined}
          onChange={(event) => setName(event.target.value)}
          placeholder="For example: Cohort 1, November 2026"
        />
        {nameError ? (
          <p id={`${id}-name-error`} className="text-sm text-danger">
            {nameError}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-start`}>Start date</Label>
        <Input id={`${id}-start`} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-slot`}>Weekly slot</Label>
        <Input
          id={`${id}-slot`}
          value={slot}
          maxLength={100}
          onChange={(event) => setSlot(event.target.value)}
          placeholder="For example: Wednesdays 10:00 to 12:00"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-notes`}>Notes</Label>
        <Textarea id={`${id}-notes`} value={notes} maxLength={1000} onChange={(event) => setNotes(event.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : cohort ? "Save cohort" : "Create cohort"}
        </Button>
      </DialogFooter>
    </form>
  );
}
