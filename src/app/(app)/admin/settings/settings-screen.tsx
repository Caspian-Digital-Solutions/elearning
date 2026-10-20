"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
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
import { Textarea } from "@/components/ui/textarea";
import { changedFields } from "@/lib/audit/diff";
import { formatDateTime } from "@/lib/format";
import { settingName, summariseSetting } from "@/lib/settings/describe";
import { checkReason, checkSetting, type Json } from "@/lib/settings/validators";
import { saveSetting } from "./actions";
import { SettingForm } from "./setting-forms";

export type SettingRecord = {
  key: string;
  value: Json;
  note: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

type SettingRow = {
  key: string;
  name: string;
  summary: string;
  note: string;
  changedBy: string;
  changedAt: string;
  changedAtSort: string;
};

const columns: DataColumn<SettingRow>[] = [
  { key: "name", header: "Setting" },
  { key: "key", header: "Key" },
  { key: "summary", header: "Current value", wrap: true },
  { key: "note", header: "Note", wrap: true },
  { key: "changedBy", header: "Last changed by" },
  { key: "changedAt", header: "When", sortKey: "changedAtSort" },
];

export function SettingsScreen({ settings }: { settings: SettingRecord[] }) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const editing = settings.find((setting) => setting.key === editingKey) ?? null;
  const current = useMemo(
    () => Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
    [settings],
  );

  const rows = useMemo<SettingRow[]>(
    () =>
      settings.map((setting) => ({
        key: setting.key,
        name: settingName(setting.key),
        summary: summariseSetting(setting.key, setting.value),
        note: setting.note ?? "",
        changedBy: setting.updatedBy ?? "Initial value",
        changedAt: formatDateTime(setting.updatedAt),
        changedAtSort: setting.updatedAt,
      })),
    [settings],
  );

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey="key"
        caption="Programme settings. Times are Malaysia time."
        exportFileName="cds-ai-academy-settings.csv"
        rowActions={(row) => (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditingKey(row.key)}>
            Edit<span className="sr-only"> {row.name}</span>
          </Button>
        )}
        emptyMessage="No settings yet. Settings are added by a database migration."
      />
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditingKey(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          {editing ? (
            <SettingEditor key={editing.key} setting={editing} current={current} onClose={() => setEditingKey(null)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SettingEditor({
  setting,
  current,
  onClose,
}: {
  setting: SettingRecord;
  current: Record<string, Json>;
  onClose: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<unknown>(setting.value);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Json | null>(null);
  const [pending, startTransition] = useTransition();

  function review() {
    const problems: string[] = [];
    let checked: Json | null = null;
    if (draftError) {
      problems.push(draftError);
    } else {
      const result = checkSetting(setting.key, draft, current);
      if (result.ok) checked = result.value;
      else problems.push(...result.errors);
    }
    const reasonCheck = checkReason(reason);
    setReasonError(reasonCheck.ok ? null : reasonCheck.errors[0]);
    if (!reasonCheck.ok) {
      problems.push(reasonCheck.errors[0]);
    }
    if (checked !== null && JSON.stringify(checked) === JSON.stringify(setting.value)) {
      problems.push("Nothing has changed. Change a value first.");
    }
    setErrors(problems);
    if (problems.length === 0 && checked !== null) {
      setPreview(checked);
    }
  }

  function save() {
    if (preview === null) {
      return;
    }
    startTransition(async () => {
      const result = await saveSetting({ key: setting.key, value: preview, reason });
      if (!result.ok) {
        setErrors([result.error]);
        return;
      }
      toast.success(`${settingName(setting.key)} saved.`);
      onClose();
    });
  }

  if (preview !== null) {
    const changes = changedFields(setting.value, preview, []);
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle>Check the change to {settingName(setting.key)}</DialogTitle>
          <DialogDescription>Nothing is saved until you select Save setting. This is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        {errors.length > 0 ? <FormError>{errors.join(" ")}</FormError> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium text-muted-foreground">Before</p>
            <p>{summariseSetting(setting.key, setting.value)}</p>
          </div>
          <div className="rounded-lg border border-accent/50 bg-accent/5 p-3">
            <p className="text-sm font-medium text-muted-foreground">After</p>
            <p>{summariseSetting(setting.key, preview)}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="mb-1 text-left font-medium">Fields that change ({changes.length})</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-1 pr-3 font-medium">Field</th>
                <th scope="col" className="py-1 pr-3 font-medium">Before</th>
                <th scope="col" className="py-1 font-medium">After</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.field} className="border-b border-border/60 align-top">
                  <td className="py-1 pr-3 font-mono text-xs">{change.field}</td>
                  <td className="py-1 pr-3">{change.before}</td>
                  <td className="py-1">{change.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border bg-secondary/50 p-3">
          <p className="text-sm text-muted-foreground">Reason</p>
          <p className="whitespace-pre-wrap">{reason.trim()}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={pending}>
            Back to edit
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save setting"}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        review();
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit {settingName(setting.key)}</DialogTitle>
        <DialogDescription>
          Key <span className="font-mono">{setting.key}</span>
          {setting.note ? `. ${setting.note}` : ""}
        </DialogDescription>
      </DialogHeader>
      {errors.length > 0 ? (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          <p className="font-medium">This cannot be saved yet:</p>
          <ul className="list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <SettingForm
        settingKey={setting.key}
        initial={setting.value}
        current={current}
        onChange={(value, error) => {
          setDraft(value);
          setDraftError(error ?? null);
        }}
      />
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-reason`}>Reason (required)</Label>
        <Textarea
          id={`${id}-reason`}
          value={reason}
          maxLength={500}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={reasonError ? `${id}-reason-error` : `${id}-reason-hint`}
          onChange={(event) => setReason(event.target.value)}
          placeholder="For example: approved by Mahgol in the 3 Nov review"
        />
        <FieldError id={`${id}-reason-error`}>{reasonError}</FieldError>
        {reasonError ? null : (
          <p id={`${id}-reason-hint`} className="text-sm text-muted-foreground">
            At least 10 characters. Saved in the audit log.
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Preview change</Button>
      </DialogFooter>
    </form>
  );
}
