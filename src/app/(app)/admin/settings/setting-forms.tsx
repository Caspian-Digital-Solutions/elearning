"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { isOneOf, streamNames, streamValues } from "@/lib/people/labels";
import { parseJsonText, type Json } from "@/lib/settings/validators";

type OnChange = (value: unknown, error?: string) => void;

type JsonObject = { [key: string]: Json };

function asObject(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asObjects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(asObject) : [];
}

/** Text from a number box: empty stays null, anything else becomes a number (NaN if not one). */
function toNumber(text: string): number | null {
  return text.trim() === "" ? null : Number(text);
}

function toText(value: unknown): string {
  return typeof value === "number" ? String(value) : "";
}

export function SettingForm({
  settingKey,
  initial,
  current,
  onChange,
}: {
  settingKey: string;
  initial: Json;
  current: Record<string, Json>;
  onChange: OnChange;
}) {
  switch (settingKey) {
    case "placement.gates":
      return <GatesForm initial={initial} sections={current["placement.week0_sections"]} onChange={onChange} />;
    case "placement.bands":
      return <BandsForm initial={initial} onChange={onChange} />;
    case "placement.week0_sections":
      return <SectionsForm initial={initial} onChange={onChange} />;
    case "placement.bridge_modules":
      return <BridgeModulesForm initial={initial} onChange={onChange} />;
    case "certification.foundation":
      return <FoundationForm initial={initial} onChange={onChange} />;
    case "certification.department":
      return <DepartmentForm initial={initial} onChange={onChange} />;
    default:
      return <JsonForm initial={initial} onChange={onChange} />;
  }
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        step={1}
        min={min}
        max={max}
        className="max-w-32"
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function sectionMax(sections: unknown, code: string): number | null {
  const section = asObjects(asObject(sections).sections).find((item) => item.code === code);
  return typeof section?.max === "number" ? section.max : null;
}

function GatesForm({ initial, sections, onChange }: { initial: Json; sections: Json | undefined; onChange: OnChange }) {
  const base = asObject(initial);
  const [safety, setSafety] = useState(toText(base.safety_min_else_foundation));
  const [prompting, setPrompting] = useState(toText(base.prompting_min_for_practitioner));
  const safetyMax = sectionMax(sections, "safety");
  const promptingMax = sectionMax(sections, "prompting");

  function update(nextSafety: string, nextPrompting: string) {
    setSafety(nextSafety);
    setPrompting(nextPrompting);
    onChange({
      ...base,
      safety_min_else_foundation: toNumber(nextSafety),
      prompting_min_for_practitioner: toNumber(nextPrompting),
    });
  }

  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">Placement gates</legend>
      <NumberField
        label="Safety gate (below this, the person is placed in Foundation)"
        hint={`Whole number from 0 to the Safety section maximum (${safetyMax ?? "not set"}).`}
        value={safety}
        min={0}
        max={safetyMax ?? undefined}
        onChange={(value) => update(value, prompting)}
      />
      <NumberField
        label="Prompting gate (needed for Practitioner)"
        hint={`Whole number from 0 to the Prompting section maximum (${promptingMax ?? "not set"}).`}
        value={prompting}
        min={0}
        max={promptingMax ?? undefined}
        onChange={(value) => update(safety, value)}
      />
    </fieldset>
  );
}

type BandRow = { min: string; max: string; stream: string; extra: JsonObject };

function BandsForm({ initial, onChange }: { initial: Json; onChange: OnChange }) {
  const id = useId();
  const base = asObject(initial);
  const [rows, setRows] = useState<BandRow[]>(() =>
    asObjects(base.bands).map(({ min, max, stream, ...extra }) => ({
      min: toText(min),
      max: toText(max),
      stream: typeof stream === "string" ? stream : "",
      extra,
    })),
  );

  function update(next: BandRow[]) {
    setRows(next);
    onChange({
      ...base,
      bands: next.map((row) => ({ ...row.extra, min: toNumber(row.min), max: toNumber(row.max), stream: row.stream })),
    });
  }

  function setRow(index: number, patch: Partial<BandRow>) {
    update(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  return (
    <fieldset className="space-y-3">
      <legend className="font-medium">Bands (Week-0 total score from 0 to 100)</legend>
      <p className="text-sm text-muted-foreground">
        The bands must cover every score from 0 to 100 once: no gaps, no overlaps.
      </p>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-2">
            <div className="space-y-1">
              <Label htmlFor={`${id}-${index}-min`}>From</Label>
              <Input
                id={`${id}-${index}-min`}
                type="number"
                inputMode="numeric"
                step={1}
                className="w-24"
                value={row.min}
                onChange={(event) => setRow(index, { min: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-${index}-max`}>To</Label>
              <Input
                id={`${id}-${index}-max`}
                type="number"
                inputMode="numeric"
                step={1}
                className="w-24"
                value={row.max}
                onChange={(event) => setRow(index, { max: event.target.value })}
              />
            </div>
            <div className="min-w-48 flex-1 space-y-1">
              <Label htmlFor={`${id}-${index}-stream`}>Stream</Label>
              <NativeSelect
                id={`${id}-${index}-stream`}
                value={row.stream}
                onChange={(event) => setRow(index, { stream: event.target.value })}
              >
                {isOneOf(streamValues, row.stream) ? null : <option value={row.stream}>Choose a stream</option>}
                {streamValues.map((stream) => (
                  <option key={stream} value={stream}>
                    {streamNames[stream]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={rows.length <= 1}
              onClick={() => update(rows.filter((_, position) => position !== index))}
            >
              Remove<span className="sr-only"> band {index + 1}</span>
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => update([...rows, { min: "", max: "", stream: "", extra: {} }])}
      >
        Add band
      </Button>
    </fieldset>
  );
}

type SectionRow = { name: string; code: string; max: string; counts: boolean; extra: JsonObject };

function SectionsForm({ initial, onChange }: { initial: Json; onChange: OnChange }) {
  const id = useId();
  const base = asObject(initial);
  const [rows, setRows] = useState<SectionRow[]>(() =>
    asObjects(base.sections).map(({ max, counts_in_total, ...extra }) => ({
      name: typeof extra.name === "string" ? extra.name : String(extra.code ?? ""),
      code: typeof extra.code === "string" ? extra.code : "",
      max: toText(max),
      counts: counts_in_total === true,
      extra,
    })),
  );
  const total = rows.filter((row) => row.counts).reduce((sum, row) => sum + (Number(row.max) || 0), 0);

  function update(next: SectionRow[]) {
    setRows(next);
    onChange({
      ...base,
      sections: next.map((row) => ({ ...row.extra, max: toNumber(row.max), counts_in_total: row.counts })),
    });
  }

  function setRow(index: number, patch: Partial<SectionRow>) {
    update(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  return (
    <fieldset className="space-y-3">
      <legend className="font-medium">Week-0 sections</legend>
      <p className="text-sm text-muted-foreground">
        The sections that count in the total must add up to 100. Leave a maximum empty for a section that has none.
      </p>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={row.code || index} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-2">
            <p className="min-w-40 flex-1 self-center font-medium">{row.name}</p>
            <div className="space-y-1">
              <Label htmlFor={`${id}-${index}-max`}>Maximum</Label>
              <Input
                id={`${id}-${index}-max`}
                type="number"
                inputMode="numeric"
                step={1}
                min={0}
                className="w-24"
                value={row.max}
                onChange={(event) => setRow(index, { max: event.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pb-1.5">
              <input
                id={`${id}-${index}-counts`}
                type="checkbox"
                className="size-4 accent-accent-strong"
                checked={row.counts}
                onChange={(event) => setRow(index, { counts: event.target.checked })}
              />
              <Label htmlFor={`${id}-${index}-counts`}>Counts in the total</Label>
            </div>
          </div>
        ))}
      </div>
      <p aria-live="polite" className="font-medium">
        Counted sections add up to {total} of 100.
      </p>
    </fieldset>
  );
}

function FoundationForm({ initial, onChange }: { initial: Json; onChange: OnChange }) {
  const id = useId();
  const base = asObject(initial);
  const [overall, setOverall] = useState(toText(base.overall_min_pct));
  const [quiz, setQuiz] = useState(toText(base.safety_quiz_pass_pct));
  const [mustPass, setMustPass] = useState(base.safety_quiz_must_pass === true);

  function update(next: { overall?: string; quiz?: string; mustPass?: boolean }) {
    const values = { overall, quiz, mustPass, ...next };
    setOverall(values.overall);
    setQuiz(values.quiz);
    setMustPass(values.mustPass);
    onChange({
      ...base,
      overall_min_pct: toNumber(values.overall),
      safety_quiz_pass_pct: toNumber(values.quiz),
      safety_quiz_must_pass: values.mustPass,
    });
  }

  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">Foundation certification</legend>
      <NumberField
        label="Overall minimum (%)"
        hint="Whole number from 0 to 100."
        value={overall}
        min={0}
        max={100}
        onChange={(value) => update({ overall: value })}
      />
      <NumberField
        label="Safety quiz pass mark (%)"
        hint="Whole number from 0 to 100."
        value={quiz}
        min={0}
        max={100}
        onChange={(value) => update({ quiz: value })}
      />
      <div className="flex items-center gap-2">
        <input
          id={`${id}-must-pass`}
          type="checkbox"
          className="size-4 accent-accent-strong"
          checked={mustPass}
          onChange={(event) => update({ mustPass: event.target.checked })}
        />
        <Label htmlFor={`${id}-must-pass`}>The safety quiz must be passed</Label>
      </div>
    </fieldset>
  );
}

function DepartmentForm({ initial, onChange }: { initial: Json; onChange: OnChange }) {
  const base = asObject(initial);
  const [weeks, setWeeks] = useState(toText(base.live_use_weeks_required));
  return (
    <NumberField
      label="Weeks of live use required"
      hint="Whole number from 1 to 12."
      value={weeks}
      min={1}
      max={12}
      onChange={(value) => {
        setWeeks(value);
        onChange({ ...base, live_use_weeks_required: toNumber(value) });
      }}
    />
  );
}

const domainCodes = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"];

function BridgeModulesForm({ initial, onChange }: { initial: Json; onChange: OnChange }) {
  const base = asObject(initial);
  const modulesMap = asObject(base.modules);
  const [rows, setRows] = useState(() =>
    domainCodes.map((code) => ({
      domain: code,
      text: Array.isArray(modulesMap[code])
        ? (modulesMap[code] as unknown[]).filter((v) => typeof v === "string").join(", ")
        : "",
    })),
  );

  function emit(next: typeof rows) {
    setRows(next);
    const modules: JsonObject = {};
    for (const row of next) {
      const codes = row.text
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      if (codes.length > 0) {
        modules[row.domain] = codes;
      }
    }
    onChange({ ...base, modules });
  }

  return (
    <fieldset className="space-y-3">
      <legend className="font-medium">Bridge modules by domain</legend>
      <p className="text-sm text-muted-foreground">
        For Practitioner placements, domains below the bridge threshold suggest these modules. Separate codes with commas.
      </p>
      {rows.map((row, index) => (
        <div key={row.domain} className="space-y-1">
          <Label>{row.domain}</Label>
          <Input
            value={row.text}
            placeholder="F1, F2"
            onChange={(event) => {
              const next = rows.map((entry, position) =>
                position === index ? { ...entry, text: event.target.value } : entry,
              );
              emit(next);
            }}
          />
        </div>
      ))}
    </fieldset>
  );
}

function JsonForm({ initial, onChange }: { initial: Json; onChange: OnChange }) {
  const id = useId();
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2));
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Value (JSON)</Label>
      <Textarea
        id={id}
        className="min-h-48 font-mono text-sm"
        spellCheck={false}
        value={text}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const parsed = parseJsonText(next);
          setError(parsed.ok ? null : parsed.errors[0]);
          onChange(parsed.ok ? parsed.value : undefined, parsed.ok ? undefined : parsed.errors[0]);
        }}
      />
      <p id={`${id}-hint`} className={error ? "text-sm text-danger" : "text-sm text-muted-foreground"}>
        {error ?? "This setting has no form of its own. Edit the JSON directly; invalid JSON cannot be saved."}
      </p>
    </div>
  );
}
