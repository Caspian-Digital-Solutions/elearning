"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { LearnerPromptCard } from "@/lib/prompts/queries";

const columns: DataColumn<LearnerPromptCard>[] = [
  { key: "title", header: "Title", wrap: true },
  { key: "tool", header: "Tool" },
  { key: "department", header: "Department" },
  { key: "taskType", header: "Task" },
  { key: "riskTier", header: "Risk" },
  { key: "testedLabel", header: "Tested" },
];

export function PromptLibraryScreen({
  prompts,
  taskTypes,
  departments,
  modules,
}: {
  prompts: LearnerPromptCard[];
  taskTypes: string[];
  departments: { id: string; name: string }[];
  modules: { id: string; label: string }[];
}) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("mine");
  const [taskType, setTaskType] = useState("");
  const [tool, setTool] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [riskTier, setRiskTier] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return prompts.filter((row) => {
      if (needle && !row.title.toLowerCase().includes(needle)) {
        return false;
      }
      if (taskType && row.taskType !== taskType) {
        return false;
      }
      if (tool && row.tool.toLowerCase() !== tool) {
        return false;
      }
      if (riskTier && row.riskTier.toLowerCase() !== riskTier) {
        return false;
      }
      return true;
    });
  }, [prompts, query, taskType, tool, riskTier]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="prompt-search">Search</Label>
          <Input
            id="prompt-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title or task"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="prompt-dept">Department</Label>
          <NativeSelect id="prompt-dept" value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option value="mine">My department and everyone</option>
            <option value="all">All departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="prompt-task">Task type</Label>
          <NativeSelect id="prompt-task" value={taskType} onChange={(event) => setTaskType(event.target.value)}>
            <option value="">Any</option>
            {taskTypes.map((task) => (
              <option key={task} value={task}>{task}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="prompt-tool">Tool</Label>
          <NativeSelect id="prompt-tool" value={tool} onChange={(event) => setTool(event.target.value)}>
            <option value="">Any</option>
            <option value="claude">Claude</option>
            <option value="perplexity">Perplexity</option>
            <option value="chatgpt">ChatGPT</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="prompt-module">Module</Label>
          <NativeSelect id="prompt-module" value={moduleId} onChange={(event) => setModuleId(event.target.value)}>
            <option value="">Any</option>
            {modules.map((mod) => (
              <option key={mod.id} value={mod.id}>{mod.label}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="prompt-risk">Risk tier</Label>
          <NativeSelect id="prompt-risk" value={riskTier} onChange={(event) => setRiskTier(event.target.value)}>
            <option value="">Any</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </NativeSelect>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No tested prompts yet" description="When trainers mark prompts as tested, they appear here." />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey="id"
          caption="Tested prompts"
          exportFileName="prompt-library.csv"
          rowActions={(row) => (
            <Link
              href={`/prompt-library/${row.slug}`}
              className="text-sm font-medium text-accent-strong underline underline-offset-2"
            >
              Open
            </Link>
          )}
        />
      )}
    </div>
  );
}
