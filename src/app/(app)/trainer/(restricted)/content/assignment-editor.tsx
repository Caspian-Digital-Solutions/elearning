"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form-error";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  publishAssignment,
  saveAssignmentDraft,
} from "@/app/(app)/trainer/(restricted)/content/assignment-actions";

type EditorProps = {
  initial: {
    id: string;
    code: string;
    title: string;
    bodyMd: string;
    moduleId: string;
    rubricId: string;
    submissionTypes: string[];
    departmentId: string | null;
    passMarkPct: number;
    isTestOut: boolean;
    isSample: boolean;
    status: string;
    version: number;
  };
  modules: { id: string; code: string; title: string }[];
  rubrics: { id: string; ref: string; title: string }[];
  departments: { id: string; name: string }[];
};

export function AssignmentEditor({ initial, modules, rubrics, departments }: EditorProps) {
  const [title, setTitle] = useState(initial.title);
  const [bodyMd, setBodyMd] = useState(initial.bodyMd);
  const [moduleId, setModuleId] = useState(initial.moduleId);
  const [rubricId, setRubricId] = useState(initial.rubricId);
  const [departmentId, setDepartmentId] = useState(initial.departmentId ?? "");
  const [passMarkPct, setPassMarkPct] = useState(String(initial.passMarkPct));
  const [linkType, setLinkType] = useState(initial.submissionTypes.includes("link"));
  const [fileType, setFileType] = useState(initial.submissionTypes.includes("file"));
  const [textType, setTextType] = useState(initial.submissionTypes.includes("text"));
  const [isTestOut, setIsTestOut] = useState(initial.isTestOut);
  const [isSample, setIsSample] = useState(initial.isSample);
  const [changeNote, setChangeNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submissionTypes = [
    ...(linkType ? ["link"] : []),
    ...(fileType ? ["file"] : []),
    ...(textType ? ["text"] : []),
  ] as ("link" | "file" | "text")[];

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveAssignmentDraft({
        id: initial.id,
        code: initial.code,
        title,
        moduleId,
        rubricId,
        bodyMd,
        submissionTypes,
        departmentId: departmentId ? departmentId : null,
        passMarkPct: Number(passMarkPct),
        isTestOut,
        isSample,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Draft saved.");
    });
  };

  const publish = () => {
    setError(null);
    startTransition(async () => {
      const saved = await saveAssignmentDraft({
        id: initial.id,
        code: initial.code,
        title,
        moduleId,
        rubricId,
        bodyMd,
        submissionTypes,
        departmentId: departmentId ? departmentId : null,
        passMarkPct: Number(passMarkPct),
        isTestOut,
        isSample,
      });
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      const result = await publishAssignment({ id: initial.id, changeNote });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Published.");
      window.location.reload();
    });
  };

  return (
    <div className="space-y-4">
      <FormError>{error}</FormError>
      <p className="text-sm text-muted-foreground">
        {initial.code} · v{initial.version} · {initial.status}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Module</Label>
          <NativeSelect value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.code} — {m.title}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label>Rubric</Label>
          <NativeSelect value={rubricId} onChange={(e) => setRubricId(e.target.value)}>
            {rubrics.map((r) => (
              <option key={r.id} value={r.id}>{r.ref} — {r.title}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label>Department (optional)</Label>
          <NativeSelect value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label>Pass mark %</Label>
          <Input type="number" min={0} max={100} value={passMarkPct} onChange={(e) => setPassMarkPct(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={linkType} onChange={(e) => setLinkType(e.target.checked)} /> Link</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={fileType} onChange={(e) => setFileType(e.target.checked)} /> File</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={textType} onChange={(e) => setTextType(e.target.checked)} /> Text</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={isTestOut} onChange={(e) => setIsTestOut(e.target.checked)} /> Test-out</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={isSample} onChange={(e) => setIsSample(e.target.checked)} /> Sample</label>
      </div>
      <div className="space-y-1">
        <Label>Brief (Markdown)</Label>
        <Textarea rows={12} value={bodyMd} onChange={(e) => setBodyMd(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Publish change note</Label>
        <Input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={save}>Save draft</Button>
        <Button type="button" disabled={pending} onClick={publish}>Publish</Button>
      </div>
    </div>
  );
}
