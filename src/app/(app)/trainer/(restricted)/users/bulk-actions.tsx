"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { DepartmentSelect } from "@/components/people/department-select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { CohortRecord, DepartmentOption, PersonRecord } from "@/lib/people/types";
import { isOneOf, streamNames, streamValues } from "@/lib/people/labels";
import { updatePeople, type UpdatePeopleInput } from "./actions";

type BulkKind = "department" | "cohort" | "stream" | "deactivate";

const notChosen = "__choose__";

const titles: Record<BulkKind, string> = {
  department: "Set department",
  cohort: "Set cohort",
  stream: "Set stream",
  deactivate: "Deactivate",
};

function peopleCount(count: number) {
  return count === 1 ? "1 person" : `${count} people`;
}

export function BulkActions({
  selectedPeople,
  departments,
  cohorts,
  onDone,
  onClear,
}: {
  selectedPeople: PersonRecord[];
  departments: DepartmentOption[];
  cohorts: CohortRecord[];
  onDone: () => void;
  onClear: () => void;
}) {
  const id = useId();
  const [kind, setKind] = useState<BulkKind | null>(null);
  const [value, setValue] = useState(notChosen);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const count = selectedPeople.length;
  if (count === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Tick people in the table to set a department, cohort or stream for several at once, or to deactivate them.
      </p>
    );
  }

  function open(next: BulkKind) {
    setKind(next);
    setValue(notChosen);
    setReason("");
    setError(null);
  }

  function confirm() {
    if (!kind) {
      return;
    }
    const change: UpdatePeopleInput = { userIds: selectedPeople.map((person) => person.id), clear: [] };
    if (kind === "deactivate") {
      change.isActive = false;
    } else if (value === notChosen) {
      setError(`Choose a ${kind} first.`);
      return;
    } else if (value === "") {
      change.clear = [kind];
    } else if (kind === "department") {
      change.departmentId = value;
    } else if (kind === "cohort") {
      change.cohortId = value;
    } else if (isOneOf(streamValues, value)) {
      change.stream = value;
    }
    if (reason.trim()) {
      change.reason = reason;
    }

    setError(null);
    startTransition(async () => {
      const result = await updatePeople(change);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`${titles[kind]}: saved for ${peopleCount(result.data.updated)}.`);
      setKind(null);
      onDone();
    });
  }

  const description =
    kind === "deactivate"
      ? "They will see “Your access is paused” until a trainer makes them active again. This is recorded in the audit log."
      : "This changes everyone listed below. It is recorded in the audit log.";

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-center"
      role="region"
      aria-label="Change ticked people"
    >
      <p className="font-medium">{peopleCount(count)} ticked</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => open("department")}>
          Set department
        </Button>
        <Button type="button" variant="outline" onClick={() => open("cohort")}>
          Set cohort
        </Button>
        <Button type="button" variant="outline" onClick={() => open("stream")}>
          Set stream
        </Button>
        <Button type="button" variant="destructive" onClick={() => open("deactivate")}>
          Deactivate
        </Button>
        <Button type="button" variant="ghost" onClick={onClear}>
          Clear ticks
        </Button>
      </div>

      <ConfirmDialog
        open={kind !== null}
        onOpenChange={(next) => !next && !pending && setKind(null)}
        title={kind === "deactivate" ? `Deactivate ${peopleCount(count)}?` : `${kind ? titles[kind] : ""} for ${peopleCount(count)}`}
        description={description}
        confirmLabel={kind === "deactivate" ? `Deactivate ${peopleCount(count)}` : `${kind ? titles[kind] : ""} for ${peopleCount(count)}`}
        onConfirm={confirm}
        pending={pending}
        closeOnConfirm={false}
      >
        <div className="space-y-4">
          <FormError>{error}</FormError>
          {kind === "department" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-value`}>New department</Label>
              <DepartmentSelect
                id={`${id}-value`}
                departments={departments}
                emptyLabel="No department (set-up pending)"
                prompt={{ value: notChosen, label: "Choose a department" }}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
          ) : null}
          {kind === "cohort" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-value`}>New cohort</Label>
              <NativeSelect id={`${id}-value`} value={value} onChange={(event) => setValue(event.target.value)}>
                <option value={notChosen}>Choose a cohort</option>
                <option value="">No cohort</option>
                {cohorts
                  .filter((cohort) => !cohort.isArchived)
                  .map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </option>
                  ))}
              </NativeSelect>
            </div>
          ) : null}
          {kind === "stream" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-value`}>New stream</Label>
              <NativeSelect id={`${id}-value`} value={value} onChange={(event) => setValue(event.target.value)}>
                <option value={notChosen}>Choose a stream</option>
                <option value="">Not set</option>
                {streamValues.map((stream) => (
                  <option key={stream} value={stream}>
                    {streamNames[stream]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <p className="text-sm font-medium" id={`${id}-names`}>
              People affected
            </p>
            <ul aria-labelledby={`${id}-names`} className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5">
              {selectedPeople.map((person) => (
                <li key={person.id}>
                  {person.name}
                  {person.name !== person.email ? <span className="text-muted-foreground"> ({person.email})</span> : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-reason`}>Reason (optional)</Label>
            <Textarea
              id={`${id}-reason`}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
