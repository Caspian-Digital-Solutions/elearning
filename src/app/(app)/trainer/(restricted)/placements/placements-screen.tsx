"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { FormError } from "@/components/shared/form-error";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { streamNames, streamValues } from "@/lib/people/labels";
import type {
  PlacementTableRow,
  QuizResultsRow,
  QuizQuestionCheckRow,
  SampleInProgressPlacementRow,
} from "@/lib/assessments/queries";
import {
  allowAssessmentRetake,
  calculatePlacement,
  confirmPlacement,
} from "@/app/(app)/trainer/(restricted)/placements/placement-actions";
import { discardSampleInProgressAttempt } from "@/app/(app)/trainer/(restricted)/placements/discard-sample-action";

type PlacementRow = {
  attemptId: string;
  userId: string;
  personName: string;
  department: string;
  submittedAt: string;
  markingProgress: string;
  scoreKnowledge: string;
  scorePrompting: string;
  scoreDepartment: string;
  scoreSafety: string;
  scoreWorkflow: string;
  total: string;
  technical: string;
  suggestedBand: string;
  suggestedStream: string;
  gates: string;
  bridges: string;
  domainFlags: string;
  confirmedStream: string;
  confirmedBy: string;
  confirmedAt: string;
  planBuilt: string;
  fullyMarked: string;
  hasPlacement: string;
};

const allPlacementColumns: DataColumn<PlacementRow>[] = [
  { key: "personName", header: "Person" },
  { key: "department", header: "Department" },
  { key: "submittedAt", header: "Submitted" },
  { key: "markingProgress", header: "Marking" },
  { key: "scoreKnowledge", header: "Knowledge" },
  { key: "scorePrompting", header: "Prompting" },
  { key: "scoreDepartment", header: "Department" },
  { key: "scoreSafety", header: "Safety" },
  { key: "scoreWorkflow", header: "Workflow" },
  { key: "total", header: "Total" },
  { key: "technical", header: "Technical" },
  { key: "suggestedBand", header: "Suggested band" },
  { key: "suggestedStream", header: "Suggested stream" },
  { key: "gates", header: "Gates failed", wrap: true },
  { key: "bridges", header: "Bridges", wrap: true },
  { key: "domainFlags", header: "Required-domain flags", wrap: true },
  { key: "confirmedStream", header: "Confirmed stream" },
  { key: "confirmedBy", header: "Confirmed by" },
  { key: "confirmedAt", header: "Confirmed at" },
  { key: "planBuilt", header: "Plan built" },
];

const defaultHidden = new Set([
  "scoreKnowledge",
  "scorePrompting",
  "scoreDepartment",
  "scoreSafety",
  "scoreWorkflow",
  "technical",
  "suggestedBand",
  "gates",
  "bridges",
  "domainFlags",
  "confirmedBy",
]);

export function PlacementsScreen({
  placementRows,
  sampleInProgressRows,
  profileRows,
  notStartedRows,
  assessmentId,
  quizResultsRows,
  quizOptions,
  questionCheckRows,
  initialQuestionCheckAssessmentId,
  onLoadQuestionCheck,
}: {
  placementRows: PlacementTableRow[];
  sampleInProgressRows: SampleInProgressPlacementRow[];
  profileRows: { question: string; option: string; count: number; department: string }[];
  notStartedRows: { name: string; department: string; lastSeen: string }[];
  assessmentId: string | null;
  quizResultsRows: QuizResultsRow[];
  quizOptions: { id: string; code: string; label: string }[];
  questionCheckRows: QuizQuestionCheckRow[];
  initialQuestionCheckAssessmentId: string | null;
  onLoadQuestionCheck: (assessmentId: string) => Promise<QuizQuestionCheckRow[]>;
}) {
  const [confirmAttempt, setConfirmAttempt] = useState<PlacementTableRow | null>(null);
  const [stream, setStream] = useState<string>("foundation");
  const [reason, setReason] = useState("");
  const [portfolio, setPortfolio] = useState(false);
  const [retakeUser, setRetakeUser] = useState<{ userId: string; name: string } | null>(null);
  const [retakeReason, setRetakeReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(defaultHidden);
  const [quizFilter, setQuizFilter] = useState<string>("");
  const [questionCheckAssessmentId, setQuestionCheckAssessmentId] = useState(
    initialQuestionCheckAssessmentId ?? "",
  );
  const [questionCheckRowsState, setQuestionCheckRowsState] = useState(questionCheckRows);
  const [questionCheckPending, startQuestionCheckTransition] = useTransition();
  const [discardAttempt, setDiscardAttempt] = useState<SampleInProgressPlacementRow | null>(null);
  const [discardReason, setDiscardReason] = useState("");

  const placementTableRows: PlacementRow[] = useMemo(
    () =>
      placementRows.map((row) => ({
        attemptId: row.attemptId,
        userId: row.userId,
        personName: row.personName,
        department: row.department,
        submittedAt: row.submittedAt ? formatDateTime(row.submittedAt) : "—",
        markingProgress: row.markingProgress,
        scoreKnowledge: row.scoreKnowledge,
        scorePrompting: row.scorePrompting,
        scoreDepartment: row.scoreDepartment,
        scoreSafety: row.scoreSafety,
        scoreWorkflow: row.scoreWorkflow,
        total: row.total,
        technical: row.technical,
        suggestedBand: row.suggestedBand,
        suggestedStream: row.suggestedStream,
        gates: row.gates,
        bridges: row.bridges,
        domainFlags: row.domainFlags,
        confirmedStream: row.confirmedStream,
        confirmedBy: row.confirmedBy,
        confirmedAt: row.confirmedAt ? formatDateTime(row.confirmedAt) : "—",
        planBuilt: row.planBuiltAt ? formatDateTime(row.planBuiltAt) : "—",
        fullyMarked: row.fullyMarked ? "yes" : "no",
        hasPlacement: row.hasPlacement ? "yes" : "no",
      })),
    [placementRows],
  );

  const visiblePlacementColumns = allPlacementColumns.filter((col) => !hiddenColumns.has(col.key));

  const filteredQuizRows = useMemo(() => {
    if (!quizFilter) {
      return quizResultsRows;
    }
    return quizResultsRows.filter((row) => row.assessmentCode === quizFilter);
  }, [quizFilter, quizResultsRows]);

  const runCalculate = (attemptId: string) => {
    startTransition(async () => {
      const result = await calculatePlacement(attemptId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Placement calculated.");
      window.location.reload();
    });
  };

  const runConfirm = () => {
    if (!confirmAttempt) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await confirmPlacement({
        attemptId: confirmAttempt.attemptId,
        stream: stream as (typeof streamValues)[number],
        reason: reason || undefined,
        portfolioReviewed: portfolio,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Placement confirmed.");
      setConfirmAttempt(null);
      window.location.reload();
    });
  };

  const runRetake = () => {
    if (!retakeUser || !assessmentId) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await allowAssessmentRetake({
        userId: retakeUser.userId,
        assessmentId,
        reason: retakeReason,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Retake allowed.");
      setRetakeUser(null);
      window.location.reload();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments and placements"
        purpose="Week 0 placement, module quiz results, and profile aggregates."
      />
      <Tabs defaultValue="placements">
        <TabsList>
          <TabsTrigger value="placements">Placements</TabsTrigger>
          <TabsTrigger value="quiz-results">Quiz results</TabsTrigger>
          <TabsTrigger value="question-check">Question check</TabsTrigger>
          <TabsTrigger value="profile">Profile answers</TabsTrigger>
          <TabsTrigger value="not-started">Not started</TabsTrigger>
        </TabsList>
        <TabsContent value="placements" className="space-y-4">
          {sampleInProgressRows.length > 0 ? (
            <DataTable
              rowKey="attemptId"
              caption="In-progress SAMPLE Week 0 attempts (trainers can discard so the learner starts fresh)"
              columns={[
                { key: "personName", header: "Person" },
                { key: "department", header: "Department" },
              ]}
              rows={sampleInProgressRows}
              rowActions={(row) => (
                <Button type="button" size="sm" variant="outline" onClick={() => setDiscardAttempt(row)}>
                  Discard sample attempt
                </Button>
              )}
            />
          ) : null}
          <fieldset className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Columns</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {allPlacementColumns.map((column) => (
                <label key={column.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(column.key)}
                    onChange={(event) => {
                      setHiddenColumns((current) => {
                        const next = new Set(current);
                        if (event.target.checked) {
                          next.delete(column.key);
                        } else {
                          next.add(column.key);
                        }
                        return next;
                      });
                    }}
                  />
                  {column.header}
                </label>
              ))}
            </div>
          </fieldset>
          <DataTable
            rowKey="attemptId"
            caption="Submitted Week 0 attempts"
            exportFileName="placements.csv"
            columns={visiblePlacementColumns}
            exportColumns={allPlacementColumns}
            rows={placementTableRows}
            rowActions={(row) => {
              const source = placementRows.find((entry) => entry.attemptId === row.attemptId);
              if (!source) {
                return null;
              }
              return (
                <div className="flex flex-wrap gap-1">
                  {source.fullyMarked && !source.confirmedAt ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => runCalculate(source.attemptId)}>
                      Calculate
                    </Button>
                  ) : null}
                  {source.hasPlacement && !source.confirmedAt ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setConfirmAttempt(source);
                        setStream(streamValues[0]);
                        setReason("");
                        setPortfolio(false);
                      }}
                    >
                      Confirm
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRetakeUser({ userId: source.userId, name: source.personName })}
                  >
                    Retake
                  </Button>
                </div>
              );
            }}
          />
        </TabsContent>
        <TabsContent value="quiz-results" className="space-y-4">
          <div className="max-w-xs space-y-1">
            <Label htmlFor="quiz-filter">Quiz</Label>
            <NativeSelect id="quiz-filter" value={quizFilter} onChange={(e) => setQuizFilter(e.target.value)}>
              <option value="">All quizzes</option>
              {quizOptions.map((opt) => (
                <option key={opt.id} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <DataTable
            rowKey="id"
            caption="Module quiz results per person"
            exportFileName="quiz-results.csv"
            columns={[
              { key: "personName", header: "Person" },
              { key: "department", header: "Department" },
              { key: "assessmentCode", header: "Quiz code" },
              { key: "assessmentTitle", header: "Quiz title" },
              { key: "passMarkPct", header: "Pass mark" },
              { key: "maxAttempts", header: "Max attempts" },
              { key: "attemptsUsed", header: "Attempts used" },
              { key: "bestPercentage", header: "Best %" },
              { key: "outcomeLabel", header: "Outcome" },
              { key: "firstPassAt", header: "First pass" },
              { key: "lastAttemptAt", header: "Last attempt" },
            ]}
            rows={filteredQuizRows.map((row) => ({
              ...row,
              id: `${row.userId}-${row.assessmentCode}`,
            }))}
            filters={[
              { key: "department", label: "Department" },
              { key: "passed", label: "Passed", options: ["Yes", "No"] },
            ]}
          />
        </TabsContent>
        <TabsContent value="question-check" className="space-y-4">
          {quizOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published module quizzes yet.</p>
          ) : (
            <>
              <div className="max-w-md space-y-1">
                <Label htmlFor="question-check-quiz">Quiz</Label>
                <NativeSelect
                  id="question-check-quiz"
                  value={questionCheckAssessmentId}
                  disabled={questionCheckPending}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setQuestionCheckAssessmentId(nextId);
                    startQuestionCheckTransition(async () => {
                      const rows = await onLoadQuestionCheck(nextId);
                      setQuestionCheckRowsState(rows);
                    });
                  }}
                >
                  {quizOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <p className="text-sm text-muted-foreground">
                Raw response counts per question (excludes test accounts).
              </p>
              <DataTable
                rowKey="itemRef"
                caption="Question check"
                exportFileName="quiz-question-check.csv"
                columns={[
                  { key: "itemRef", header: "Item ref" },
                  { key: "prompt", header: "Prompt", wrap: true },
                  { key: "answeredCount", header: "Answered" },
                  { key: "optionBreakdown", header: "Option counts", wrap: true },
                ]}
                rows={questionCheckRowsState.map((row) => ({ ...row, id: row.itemRef }))}
              />
            </>
          )}
        </TabsContent>
        <TabsContent value="profile">
          <DataTable
            rowKey="id"
            caption="Profile question aggregates"
            exportFileName="profile-answers.csv"
            columns={[
              { key: "question", header: "Question" },
              { key: "option", header: "Answer" },
              { key: "department", header: "Department" },
              { key: "count", header: "Count" },
            ]}
            rows={profileRows.map((row, index) => ({ ...row, id: String(index), count: String(row.count) }))}
          />
        </TabsContent>
        <TabsContent value="not-started">
          <DataTable
            rowKey="name"
            caption="Active learners without a Week 0 submission"
            exportFileName="week0-not-started.csv"
            columns={[
              { key: "name", header: "Person" },
              { key: "department", header: "Department" },
              { key: "lastSeen", header: "Last seen" },
            ]}
            rows={notStartedRows}
          />
        </TabsContent>
      </Tabs>

      {confirmAttempt ? (
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Confirm placement for {confirmAttempt.personName}</h2>
          <FormError>{error}</FormError>
          <div className="space-y-1">
            <Label>Stream</Label>
            <NativeSelect value={stream} onChange={(e) => setStream(e.target.value)}>
              {streamValues.map((value) => (
                <option key={value} value={value}>{streamNames[value]}</option>
              ))}
            </NativeSelect>
          </div>
          <Textarea
            placeholder="Reason if overriding the suggestion"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={portfolio} onChange={(e) => setPortfolio(e.target.checked)} />
            Portfolio reviewed (required for Champion)
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmAttempt(null)}>Cancel</Button>
            <Button type="button" disabled={pending} onClick={runConfirm}>Confirm stream</Button>
          </div>
        </div>
      ) : null}

      {discardAttempt ? (
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Discard sample attempt for {discardAttempt.personName}</h2>
          <FormError>{error}</FormError>
          <Textarea
            placeholder="Reason (at least ten characters)"
            value={discardReason}
            onChange={(e) => setDiscardReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setDiscardAttempt(null)}>Cancel</Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await discardSampleInProgressAttempt({
                    attemptId: discardAttempt.attemptId,
                    reason: discardReason,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  toast.success("Sample attempt discarded.");
                  setDiscardAttempt(null);
                  window.location.reload();
                });
              }}
            >
              Discard attempt
            </Button>
          </div>
        </div>
      ) : null}

      {retakeUser ? (
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Allow retake for {retakeUser.name}</h2>
          <FormError>{error}</FormError>
          <Textarea
            placeholder="Reason (at least ten characters)"
            value={retakeReason}
            onChange={(e) => setRetakeReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setRetakeUser(null)}>Cancel</Button>
            <Button type="button" disabled={pending} onClick={runRetake}>Allow retake</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
