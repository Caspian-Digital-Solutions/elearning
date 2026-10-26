"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { logSkillUsageAction, updateSkillUsageAction } from "@/lib/skills/actions";
import { canEditUsageLog, formatApprovalLine, skillStatusLabel } from "@/lib/skills/display";
import type { SkillApprovalRow, SkillRow, SkillUsageLogRow, SkillVersionRow } from "@/lib/skills/types";

export function SkillDetailClient({
  skill,
  versions,
  approvals,
  approverNames,
  myLogs,
  today,
}: {
  skill: SkillRow;
  versions: SkillVersionRow[];
  approvals: SkillApprovalRow[];
  approverNames: Record<string, string>;
  myLogs: SkillUsageLogRow[];
  today: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const live = skill.status === "live";

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm text-muted-foreground">{skillStatusLabel(skill.status)} · v{skill.current_version}</p>
        <p className="text-base">{skill.description}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-heading">Department boundaries</h2>
        <p className="text-sm whitespace-pre-wrap">{skill.boundaries_md}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-heading">How to switch it on in Claude</h2>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <Markdown remarkPlugins={[remarkGfm]}>{skill.how_to_enable_md}</Markdown>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-heading">Version history</h2>
        <ul className="space-y-3 text-sm">
          {versions.map((ver) => (
            <li key={ver.id} className="rounded-md border border-border p-3">
              <p className="font-medium">Version {ver.version}</p>
              {ver.changelog_md ? <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{ver.changelog_md}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      {approvals.length ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-heading">Approvals</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {approvals.map((a) => (
              <li key={a.id}>{formatApprovalLine(a, approverNames[a.approver_id] ?? "Approver")}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {live ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-heading">Log a use</h2>
          <UsageForm
            skillId={skill.id}
            skillVersion={skill.current_version}
            defaultDate={today}
            onDone={(text) => setMessage(text)}
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-heading">My Skill use</h2>
        {myLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have not logged any uses yet.</p>
        ) : (
          <ul className="space-y-4">
            {myLogs.map((log) => (
              <li key={log.id} className="rounded-md border border-border p-3 text-sm">
                {canEditUsageLog(log.created_at) ? (
                  <EditableLog log={log} onDone={(text) => setMessage(text)} />
                ) : (
                  <p>
                    {log.used_on}: {log.task} ({log.outcome})
                    {log.minutes_saved != null ? ` · ~${log.minutes_saved} min saved` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
    </div>
  );
}

function UsageForm({
  skillId,
  skillVersion,
  defaultDate,
  onDone,
}: {
  skillId: string;
  skillVersion: string;
  defaultDate: string;
  onDone: (message: string) => void;
}) {
  const [usedOn, setUsedOn] = useState(defaultDate);
  const [task, setTask] = useState("");
  const [outcome, setOutcome] = useState<"kept" | "edited" | "discarded">("kept");
  const [minutes, setMinutes] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid max-w-lg gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void logSkillUsageAction({
          skillId,
          skillVersion,
          usedOn,
          task,
          outcome,
          minutesSaved: minutes.trim() === "" ? undefined : Number(minutes),
          declaration: declaration ? true : (false as true),
        }).then((result) => {
          setPending(false);
          onDone(result.ok ? "Use logged." : result.error);
          if (result.ok) {
            window.location.reload();
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="used-on">Date</Label>
        <Input id="used-on" type="date" value={usedOn} onChange={(e) => setUsedOn(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="task">Task (a few words)</Label>
        <Input id="task" value={task} onChange={(e) => setTask(e.target.value)} maxLength={200} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="outcome">Outcome</Label>
        <NativeSelect id="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
          <option value="kept">Kept as-is</option>
          <option value="edited">Edited</option>
          <option value="discarded">Discarded</option>
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="minutes">Minutes saved (optional)</Label>
        <Input id="minutes" type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={declaration}
          onChange={(e) => setDeclaration(e.target.checked)}
          className="mt-1"
        />
        <span>This log does not include client or personal data.</span>
      </label>
      <Button type="submit" disabled={pending || !declaration}>
        Log use
      </Button>
    </form>
  );
}

function EditableLog({ log, onDone }: { log: SkillUsageLogRow; onDone: (message: string) => void }) {
  const [task, setTask] = useState(log.task);
  const [outcome, setOutcome] = useState(log.outcome);
  const [usedOn, setUsedOn] = useState(log.used_on);
  const [minutes, setMinutes] = useState(log.minutes_saved?.toString() ?? "");
  const [declaration, setDeclaration] = useState(log.declaration);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void updateSkillUsageAction({
          logId: log.id,
          skillId: log.skill_id,
          skillVersion: log.skill_version,
          usedOn,
          task,
          outcome,
          minutesSaved: minutes.trim() === "" ? undefined : Number(minutes),
          declaration: declaration ? true : (false as true),
        }).then((result) => {
          setPending(false);
          onDone(result.ok ? "Log updated." : result.error);
          if (result.ok) {
            window.location.reload();
          }
        });
      }}
    >
      <Input type="date" value={usedOn} onChange={(e) => setUsedOn(e.target.value)} />
      <Input value={task} onChange={(e) => setTask(e.target.value)} maxLength={200} />
      <NativeSelect value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
        <option value="kept">Kept</option>
        <option value="edited">Edited</option>
        <option value="discarded">Discarded</option>
      </NativeSelect>
      <Input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Minutes saved" />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} />
        <span>No client data</span>
      </label>
      <Button type="submit" size="sm" disabled={pending || !declaration}>
        Save changes
      </Button>
    </form>
  );
}
