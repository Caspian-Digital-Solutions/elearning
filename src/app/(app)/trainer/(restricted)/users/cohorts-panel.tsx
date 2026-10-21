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
import { buildCohortCalendarPreview } from "@/lib/calendar/cohort-preview";
import { formatCalendarDate } from "@/lib/format";
import type { CohortBreakInput, CohortRecord } from "@/lib/people/types";
import { deleteCohort, setCohortArchived } from "./actions";
import { saveCohortWithCalendar } from "./cohort-actions";

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
  { key: "startDate", header: "Week 0 start", sortKey: "startDateSort" },
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
        startDate: formatCalendarDate(cohort.week0StartDate ?? cohort.startDate),
        startDateSort: cohort.week0StartDate ?? cohort.startDate ?? "",
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
  const [week0StartDate, setWeek0StartDate] = useState(cohort?.week0StartDate ?? cohort?.startDate ?? "");
  const [slot, setSlot] = useState(cohort?.slot ?? "");
  const [notes, setNotes] = useState(cohort?.notes ?? "");
  const [breaks, setBreaks] = useState<CohortBreakInput[]>(cohort?.breaks ?? []);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => {
    if (!week0StartDate) {
      return [];
    }
    return buildCohortCalendarPreview(
      week0StartDate,
      breaks.map((row) => ({ startDate: row.startDate, weeks: row.weeks, label: row.label })),
    );
  }, [week0StartDate, breaks]);

  function save() {
    if (!name.trim()) {
      setNameError("Give the cohort a name.");
      setError("The cohort was not saved. Check the name.");
      return;
    }
    setNameError(null);
    setError(null);
    startTransition(async () => {
      const result = await saveCohortWithCalendar({
        id: cohort?.id,
        name,
        startDate,
        week0StartDate,
        slot,
        notes,
        breaks,
      });
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
        <DialogDescription>
          Week 0 start (Monday), breaks and weekly slot. Preview the calendar before saving.
        </DialogDescription>
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
        <Label htmlFor={`${id}-week0`}>Week 0 start (Monday)</Label>
        <Input
          id={`${id}-week0`}
          type="date"
          value={week0StartDate}
          onChange={(event) => setWeek0StartDate(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Breaks</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setBreaks((current) => [...current, { startDate: week0StartDate || "", weeks: 1, label: "Break" }])
            }
          >
            Add break
          </Button>
        </div>
        {breaks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No breaks. Programme weeks follow consecutive Mondays.</p>
        ) : (
          <ul className="space-y-2">
            {breaks.map((row, index) => (
              <li key={index} className="grid gap-2 rounded border p-2 sm:grid-cols-[1fr_auto_auto_1fr_auto]">
                <Input
                  type="date"
                  aria-label="Break start Monday"
                  value={row.startDate}
                  onChange={(event) =>
                    setBreaks((current) =>
                      current.map((item, i) => (i === index ? { ...item, startDate: event.target.value } : item)),
                    )
                  }
                />
                <Input
                  type="number"
                  min={1}
                  max={12}
                  aria-label="Break weeks"
                  className="w-20"
                  value={row.weeks}
                  onChange={(event) =>
                    setBreaks((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, weeks: Number(event.target.value) || 1 } : item,
                      ),
                    )
                  }
                />
                <Input
                  aria-label="Break label"
                  value={row.label}
                  onChange={(event) =>
                    setBreaks((current) =>
                      current.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)),
                    )
                  }
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setBreaks((current) => current.filter((_, i) => i !== index))}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {preview.length > 0 ? (
        <div className="max-h-48 overflow-auto rounded border text-xs">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-secondary/50 text-left">
                <th className="p-2">Week</th>
                <th className="p-2">Monday</th>
                <th className="p-2">Friday</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.programmeWeek} className="border-b border-border/60">
                  <td className="p-2">{row.label}</td>
                  <td className="p-2">{row.monday}</td>
                  <td className="p-2">{row.friday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-start`}>Legacy start date (optional)</Label>
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
