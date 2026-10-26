"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { savePromptDraft, submitPromptForReview } from "@/app/(app)/trainer/(restricted)/content/prompt-actions";

export function PromptEditor({
  promptId,
  initial,
  taskTypes,
  departments,
  modules,
  canSubmitForReview,
}: {
  promptId?: string;
  initial: {
    title: string;
    slug: string;
    body: string;
    taskType: string;
    tool: string;
    riskTier: string;
    departmentId: string | null;
    moduleId: string | null;
    usageNotesMd: string;
    exampleMd: string;
    status: string;
  };
  taskTypes: string[];
  departments: { id: string; name: string }[];
  modules: { id: string; label: string }[];
  canSubmitForReview: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [body, setBody] = useState(initial.body);
  const [taskType, setTaskType] = useState(initial.taskType);
  const [tool, setTool] = useState(initial.tool);
  const [riskTier, setRiskTier] = useState(initial.riskTier);
  const [departmentId, setDepartmentId] = useState(initial.departmentId ?? "");
  const [moduleId, setModuleId] = useState(initial.moduleId ?? "");
  const [usageNotesMd, setUsageNotesMd] = useState(initial.usageNotesMd);
  const [exampleMd, setExampleMd] = useState(initial.exampleMd);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    setError(null);
    const result = await savePromptDraft({
      id: promptId,
      title,
      slug,
      body,
      taskType,
      tool: tool as "claude" | "perplexity" | "chatgpt",
      riskTier: riskTier as "low" | "medium" | "high",
      departmentId: departmentId || null,
      moduleId: moduleId || null,
      usageNotesMd,
      exampleMd,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Draft saved.");
    if (!promptId) {
      router.replace(`/trainer/content/prompts/${result.id}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="prompt-title">Title</Label>
          <Input id="prompt-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="prompt-slug">Slug</Label>
          <Input id="prompt-slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="prompt-task">Task type</Label>
          <NativeSelect id="prompt-task" value={taskType} onChange={(event) => setTaskType(event.target.value)}>
            {taskTypes.map((task) => (
              <option key={task} value={task}>{task}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="prompt-tool">Tool</Label>
          <NativeSelect id="prompt-tool" value={tool} onChange={(event) => setTool(event.target.value)}>
            <option value="claude">Claude</option>
            <option value="perplexity">Perplexity</option>
            <option value="chatgpt">ChatGPT</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="prompt-risk">Risk tier</Label>
          <NativeSelect id="prompt-risk" value={riskTier} onChange={(event) => setRiskTier(event.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="prompt-dept">Department</Label>
          <NativeSelect id="prompt-dept" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">Everyone</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="prompt-module">Module (optional)</Label>
          <NativeSelect id="prompt-module" value={moduleId} onChange={(event) => setModuleId(event.target.value)}>
            <option value="">None</option>
            {modules.map((mod) => (
              <option key={mod.id} value={mod.id}>{mod.label}</option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="prompt-body">Prompt body (use {"{{placeholder}}"} syntax)</Label>
        <Textarea id="prompt-body" rows={10} value={body} onChange={(event) => setBody(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="prompt-usage">Usage notes (Markdown)</Label>
        <Textarea id="prompt-usage" rows={5} value={usageNotesMd} onChange={(event) => setUsageNotesMd(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="prompt-example">Example (fictional only, Markdown)</Label>
        <Textarea id="prompt-example" rows={5} value={exampleMd} onChange={(event) => setExampleMd(event.target.value)} />
      </div>
      <FormError>{error}</FormError>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => void save()}>Save draft</Button>
        {canSubmitForReview && promptId && initial.status === "draft" ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              void submitPromptForReview(promptId, "Ready for trainer review.").then((result) => {
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Submitted for review.");
                router.push("/trainer/content?tab=prompts");
              })
            }
          >
            Submit for review
          </Button>
        ) : null}
      </div>
    </div>
  );
}
