"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataColumn, type DataFilter } from "@/components/shared/data-table";
import { FieldError, FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { PersonRecord } from "@/lib/people/types";
import {
  appRoleValues,
  isOneOf,
  progressScopeValues,
  roleNames,
  scopeNames,
  suggestedScope,
  type AppRole,
  type ProgressScope,
} from "@/lib/people/labels";
import { checkReason } from "@/lib/settings/validators";
import { changeRole } from "./actions";

type RoleRow = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  scope: string;
  active: string;
};

const columns: DataColumn<RoleRow>[] = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "department", header: "Department" },
  { key: "role", header: "Role" },
  { key: "scope", header: "Progress scope" },
  { key: "active", header: "Active" },
];

const filters: DataFilter<RoleRow>[] = [
  { key: "role", label: "Role", options: appRoleValues.map((role) => roleNames[role]) },
  { key: "department", label: "Department" },
];

type Draft = { person: PersonRecord; role: AppRole; scope: ProgressScope; reason: string };

function describe(role: AppRole, scope: ProgressScope) {
  return `${roleNames[role]} (progress scope ${scopeNames[scope]})`;
}

export function RolesScreen({ people, currentUserId }: { people: PersonRecord[]; currentUserId: string }) {
  const [editing, setEditing] = useState<PersonRecord | null>(null);
  const [confirming, setConfirming] = useState<Draft | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const rows = useMemo<RoleRow[]>(
    () =>
      people.map((person) => ({
        id: person.id,
        name: person.id === currentUserId ? `${person.name} (you)` : person.name,
        email: person.email,
        department: person.departmentName ?? "",
        role: roleNames[person.role],
        scope: scopeNames[person.scope],
        active: person.isActive ? "Yes" : "No",
      })),
    [people, currentUserId],
  );
  const activeAdmins = people.filter((person) => person.role === "admin" && person.isActive);

  function submit() {
    if (!confirming) {
      return;
    }
    const draft = confirming;
    setConfirmError(null);
    startTransition(async () => {
      const result = await changeRole({
        userId: draft.person.id,
        role: draft.role,
        scope: draft.scope,
        reason: draft.reason,
      });
      if (!result.ok) {
        setConfirmError(result.error);
        return;
      }
      toast.success(`${draft.person.name} is now ${describe(draft.role, draft.scope)}.`);
      setConfirming(null);
    });
  }

  return (
    <div className="space-y-4">
      {activeAdmins.length <= 1 ? (
        <div role="status" className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-foreground">
          <p className="font-medium">Only one admin.</p>
          <p>Add a named backup admin so the platform is not locked to one person.</p>
          {activeAdmins[0] ? (
            <p className="mt-1 text-sm text-muted-foreground">Active admin: {activeAdmins[0].name}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground">
          Active admins ({activeAdmins.length}): {activeAdmins.map((person) => person.name).join(", ")}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey="id"
        caption="Everyone who has signed in, with their role and progress scope."
        exportFileName="cds-ai-academy-roles.csv"
        filters={filters}
        rowActions={(row) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const person = byId.get(row.id);
              if (person) setEditing(person);
            }}
          >
            Change role<span className="sr-only"> for {row.name}</span>
          </Button>
        )}
        emptyMessage="No one matches these filters."
      />

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          {editing ? (
            <RoleForm
              key={editing.id}
              person={editing}
              onCancel={() => setEditing(null)}
              onContinue={(draft) => {
                setEditing(null);
                setConfirmError(null);
                setConfirming(draft);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && !pending && setConfirming(null)}
        title="Confirm role change"
        description={
          confirming
            ? `Change ${confirming.person.name} from ${describe(confirming.person.role, confirming.person.scope)} to ${describe(confirming.role, confirming.scope)}? This is recorded in the audit log.`
            : ""
        }
        confirmLabel="Change role"
        onConfirm={submit}
        pending={pending}
        closeOnConfirm={false}
      >
        <div className="space-y-3">
          <FormError>{confirmError}</FormError>
          {confirming ? (
            <div className="rounded-lg border border-border bg-secondary/50 p-3">
              <p className="text-sm text-muted-foreground">Reason</p>
              <p className="whitespace-pre-wrap">{confirming.reason.trim()}</p>
            </div>
          ) : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}

function RoleForm({
  person,
  onCancel,
  onContinue,
}: {
  person: PersonRecord;
  onCancel: () => void;
  onContinue: (draft: Draft) => void;
}) {
  const id = useId();
  const [role, setRole] = useState<AppRole>(person.role);
  const [scope, setScope] = useState<ProgressScope>(person.scope);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ form?: string; reason?: string }>({});

  function next() {
    if (role === person.role && scope === person.scope) {
      setErrors({ form: "That person already has this role and progress scope. Choose a different one." });
      return;
    }
    const reasonCheck = checkReason(reason);
    if (!reasonCheck.ok) {
      setErrors({ form: "Check the reason.", reason: reasonCheck.errors[0] });
      return;
    }
    setErrors({});
    onContinue({ person, role, scope, reason: reasonCheck.value });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        next();
      }}
    >
      <DialogHeader>
        <DialogTitle>Change role for {person.name}</DialogTitle>
        <DialogDescription>Now: {describe(person.role, person.scope)}</DialogDescription>
      </DialogHeader>
      <FormError>{errors.form}</FormError>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-role`}>New role</Label>
        <NativeSelect
          id={`${id}-role`}
          value={role}
          onChange={(event) => {
            const value = event.target.value;
            if (isOneOf(appRoleValues, value)) {
              setRole(value);
              setScope(suggestedScope[value]);
            }
          }}
        >
          {appRoleValues.map((value) => (
            <option key={value} value={value}>
              {roleNames[value]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-scope`}>New progress scope</Label>
        <NativeSelect
          id={`${id}-scope`}
          value={scope}
          aria-describedby={`${id}-scope-hint`}
          onChange={(event) => {
            const value = event.target.value;
            if (isOneOf(progressScopeValues, value)) setScope(value);
          }}
        >
          {progressScopeValues.map((value) => (
            <option key={value} value={value}>
              {scopeNames[value]}
            </option>
          ))}
        </NativeSelect>
        <p id={`${id}-scope-hint`} className="text-sm text-muted-foreground">
          Usual for {roleNames[role]}: {scopeNames[suggestedScope[role]]}. Self sees own progress; Department sees
          their department; All sees everyone.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-reason`}>Reason (required)</Label>
        <Textarea
          id={`${id}-reason`}
          value={reason}
          maxLength={500}
          aria-invalid={errors.reason ? true : undefined}
          aria-describedby={errors.reason ? `${id}-reason-error` : `${id}-reason-hint`}
          onChange={(event) => setReason(event.target.value)}
          placeholder="For example: Mahgol runs the training sessions from November"
        />
        <FieldError id={`${id}-reason-error`}>{errors.reason}</FieldError>
        {errors.reason ? null : (
          <p id={`${id}-reason-hint`} className="text-sm text-muted-foreground">
            At least 10 characters. Saved in the audit log.
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Review change</Button>
      </DialogFooter>
    </form>
  );
}
