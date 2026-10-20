"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { DepartmentSelect } from "@/components/people/department-select";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { CohortRecord, DepartmentOption, PersonRecord } from "@/lib/people/types";
import {
  isOneOf,
  pathwayNames,
  roleNames,
  scopeNames,
  specialistPathwayValues,
  streamNames,
  streamValues,
} from "@/lib/people/labels";
import { updatePeople, type UpdatePeopleInput } from "./actions";

export function PersonEditSheet({
  person,
  departments,
  cohorts,
  isSelf,
  canPauseAdmins,
  onClose,
}: {
  person: PersonRecord | null;
  departments: DepartmentOption[];
  cohorts: CohortRecord[];
  isSelf: boolean;
  canPauseAdmins: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={person !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {person ? (
          <EditForm
            key={person.id}
            person={person}
            departments={departments}
            cohorts={cohorts}
            isSelf={isSelf}
            canPauseAdmins={canPauseAdmins}
            onClose={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function EditForm({
  person,
  departments,
  cohorts,
  isSelf,
  canPauseAdmins,
  onClose,
}: {
  person: PersonRecord;
  departments: DepartmentOption[];
  cohorts: CohortRecord[];
  isSelf: boolean;
  canPauseAdmins: boolean;
  onClose: () => void;
}) {
  const id = useId();
  const [departmentId, setDepartmentId] = useState(person.departmentId ?? "");
  const [stream, setStream] = useState<string>(person.stream ?? "");
  const [pathway, setPathway] = useState<string>(person.pathway ?? "");
  const [cohortId, setCohortId] = useState(person.cohortId ?? "");
  const [isActive, setIsActive] = useState(person.isActive);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cohortChoices = cohorts.filter((cohort) => !cohort.isArchived || cohort.id === person.cohortId);
  const activeLocked = isSelf || (person.role === "admin" && !canPauseAdmins);
  const activeNote = isSelf
    ? "You cannot pause your own access."
    : person.role === "admin" && !canPauseAdmins
      ? "Only an admin can pause or restore an admin's access."
      : null;

  function save() {
    const change: UpdatePeopleInput = { userIds: [person.id], clear: [] };
    const clear: NonNullable<UpdatePeopleInput["clear"]> = [];

    if (departmentId !== (person.departmentId ?? "")) {
      if (departmentId) change.departmentId = departmentId;
      else clear.push("department");
    }
    if (stream !== (person.stream ?? "")) {
      if (isOneOf(streamValues, stream)) change.stream = stream;
      else clear.push("stream");
    }
    if (pathway !== (person.pathway ?? "")) {
      if (isOneOf(specialistPathwayValues, pathway)) change.pathway = pathway;
      else clear.push("specialist_pathway");
    }
    if (cohortId !== (person.cohortId ?? "")) {
      if (cohortId) change.cohortId = cohortId;
      else clear.push("cohort");
    }
    if (isActive !== person.isActive) {
      change.isActive = isActive;
    }
    change.clear = clear;
    if (reason.trim()) {
      change.reason = reason;
    }

    const changed =
      clear.length > 0 ||
      [change.departmentId, change.stream, change.pathway, change.cohortId, change.isActive].some(
        (value) => value !== undefined,
      );
    if (!changed) {
      setError("Nothing to change. Change at least one field, or close the panel.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updatePeople(change);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Saved changes for ${person.name}.`);
      onClose();
    });
  }

  return (
    <form
      className="flex min-h-full flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <SheetHeader className="pr-12">
        <SheetTitle className="text-lg">Edit {person.name}</SheetTitle>
        <SheetDescription>{person.email}</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4">
        <FormError>{error}</FormError>

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-department`}>Department</Label>
          <DepartmentSelect
            id={`${id}-department`}
            departments={departments}
            keepId={person.departmentId}
            emptyLabel="No department (set-up pending)"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-stream`}>Stream</Label>
          <NativeSelect id={`${id}-stream`} value={stream} onChange={(event) => setStream(event.target.value)}>
            <option value="">Not set</option>
            {streamValues.map((value) => (
              <option key={value} value={value}>
                {streamNames[value]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-pathway`}>Specialist pathway</Label>
          <NativeSelect id={`${id}-pathway`} value={pathway} onChange={(event) => setPathway(event.target.value)}>
            <option value="">Not set</option>
            {specialistPathwayValues.map((value) => (
              <option key={value} value={value}>
                {pathwayNames[value]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-cohort`}>Cohort</Label>
          <NativeSelect id={`${id}-cohort`} value={cohortId} onChange={(event) => setCohortId(event.target.value)}>
            <option value="">No cohort</option>
            {cohortChoices.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
                {cohort.isArchived ? " (archived)" : ""}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              id={`${id}-active`}
              type="checkbox"
              className="size-4 accent-accent-strong"
              checked={isActive}
              disabled={activeLocked}
              aria-describedby={activeNote ? `${id}-active-note` : undefined}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <Label htmlFor={`${id}-active`}>Active (can use the platform)</Label>
          </div>
          {activeNote ? (
            <p id={`${id}-active-note`} className="text-sm text-muted-foreground">
              {activeNote}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-secondary/50 p-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Role</dt>
            <dd>{roleNames[person.role]}</dd>
            <dt className="text-muted-foreground">Progress scope</dt>
            <dd>{scopeNames[person.scope]}</dd>
          </dl>
          <p className="mt-2 text-sm text-muted-foreground">Changed by an admin in Admin › Roles</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-reason`}>Reason (optional)</Label>
          <Textarea
            id={`${id}-reason`}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="For example: joined the Creative team on 3 Nov"
          />
          <p className="text-sm text-muted-foreground">Saved in the audit log with the change.</p>
        </div>
      </div>
      <SheetFooter className="flex-row justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  );
}
