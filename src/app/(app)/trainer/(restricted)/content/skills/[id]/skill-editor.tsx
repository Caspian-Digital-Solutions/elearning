"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  retireSkillAction,
  saveSkillVersionAction,
  setSkillLiveAction,
  submitSkillForReviewAction,
  updateSkillMetadataAction,
} from "@/lib/skills/actions";
import type { SkillRow, SkillVersionRow } from "@/lib/skills/types";

export function SkillEditor({
  skill,
  versions,
  minTestCases,
}: {
  skill: SkillRow;
  versions: SkillVersionRow[];
  minTestCases: number;
}) {
  const [displayName, setDisplayName] = useState(skill.display_name);
  const [description, setDescription] = useState(skill.description);
  const [howTo, setHowTo] = useState(skill.how_to_enable_md);
  const [boundaries, setBoundaries] = useState(skill.boundaries_md);
  const [version, setVersion] = useState(skill.current_version === "0.0" ? "1.0" : skill.current_version);
  const [changelog, setChangelog] = useState("");
  const [skillMd, setSkillMd] = useState("");
  const [testCount, setTestCount] = useState(String(minTestCases));
  const [testPassed, setTestPassed] = useState(String(minTestCases));
  const [testNotes, setTestNotes] = useState("");
  const [liveSince, setLiveSince] = useState(new Date().toISOString().slice(0, 10));
  const [retireReason, setRetireReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const saveMeta = () => {
    void updateSkillMetadataAction({
      skillId: skill.id,
      displayName,
      description,
      howToEnableMd: howTo,
      boundariesMd: boundaries,
    }).then((result) => setMessage(result.ok ? "Catalogue entry saved." : result.error));
  };

  const saveVersion = () => {
    void saveSkillVersionAction({
      skillId: skill.id,
      version,
      changelogMd: changelog,
      skillMdText: skillMd,
      testCasesCount: Number(testCount),
      testCasesPassed: Number(testPassed),
      testNotesMd: testNotes,
      catalogueName: skill.name,
      catalogueDescription: description,
    }).then((result) => {
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Version saved.");
      void submitSkillForReviewAction(result.versionId).then((submitted) =>
        setMessage(submitted.ok ? "Submitted for review." : submitted.error),
      );
    });
  };

  return (
    <div className="space-y-8">
      <section className="grid max-w-2xl gap-3">
        <h2 className="text-base font-semibold text-heading">Catalogue entry</h2>
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={skill.name} readOnly />
        </div>
        <div className="space-y-1.5">
          <Label>Display name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={1024} />
        </div>
        <div className="space-y-1.5">
          <Label>How to enable (Markdown)</Label>
          <Textarea value={howTo} onChange={(e) => setHowTo(e.target.value)} rows={4} />
        </div>
        <div className="space-y-1.5">
          <Label>Boundaries</Label>
          <Textarea value={boundaries} onChange={(e) => setBoundaries(e.target.value)} rows={3} />
        </div>
        <Button type="button" onClick={saveMeta}>Save entry</Button>
      </section>

      <section className="grid max-w-2xl gap-3">
        <h2 className="text-base font-semibold text-heading">Add or update a version</h2>
        <p className="text-sm text-muted-foreground">At least {minTestCases} test cases recorded and passed before review.</p>
        <div className="space-y-1.5">
          <Label>Version</Label>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Changelog</Label>
          <Textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label>Instructions file text</Label>
          <Textarea value={skillMd} onChange={(e) => setSkillMd(e.target.value)} rows={10} />
        </div>
        <div className="flex gap-4">
          <div className="space-y-1.5">
            <Label>Test cases</Label>
            <Input type="number" min={0} value={testCount} onChange={(e) => setTestCount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Passed</Label>
            <Input type="number" min={0} value={testPassed} onChange={(e) => setTestPassed(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Test notes</Label>
          <Textarea value={testNotes} onChange={(e) => setTestNotes(e.target.value)} rows={2} />
        </div>
        <Button type="button" onClick={saveVersion}>Save version and submit for review</Button>
      </section>

      {skill.status === "approved" || (skill.status === "live" && skill.review_version_id) ? (
        <section className="grid max-w-md gap-3">
          <h2 className="text-base font-semibold text-heading">Go live</h2>
          <div className="space-y-1.5">
            <Label>Live since</Label>
            <Input type="date" value={liveSince} onChange={(e) => setLiveSince(e.target.value)} />
          </div>
          <Button
            type="button"
            onClick={() =>
              void setSkillLiveAction({ skillId: skill.id, liveSince }).then((result) =>
                setMessage(result.ok ? "Skill is live." : result.error),
              )
            }
          >
            Set live
          </Button>
        </section>
      ) : null}

      {skill.status === "live" ? (
        <section className="grid max-w-md gap-3">
          <h2 className="text-base font-semibold text-heading">Retire</h2>
          <Textarea value={retireReason} onChange={(e) => setRetireReason(e.target.value)} rows={2} placeholder="Reason (10+ characters)" />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void retireSkillAction({ skillId: skill.id, reason: retireReason }).then((result) =>
                setMessage(result.ok ? "Skill retired." : result.error),
              )
            }
          >
            Retire Skill
          </Button>
        </section>
      ) : null}

      {versions.length ? (
        <section>
          <h2 className="text-base font-semibold text-heading">Saved versions</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {versions.map((ver) => (
              <li key={ver.id}>
                v{ver.version} — {ver.test_cases_passed}/{ver.test_cases_count} tests
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
    </div>
  );
}
