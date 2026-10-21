import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { MarkdownView } from "@/components/shared/markdown-view";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import {
  loadAttemptResponses,
  loadConfirmedPlacementResult,
  loadPublishedAssessmentByCode,
  loadUserAttemptForAssessment,
  streamLabel,
} from "@/lib/assessments/queries";
import { startAssessmentAttempt } from "@/app/(app)/assessments/attempt-actions";
import { AssessmentAttemptClient } from "@/app/(app)/assessments/assessment-attempt-client";

export const metadata: Metadata = {
  title: "Assessment",
};

export default function Page({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading.</p>}>
      <AssessmentPage params={params} />
    </Suspense>
  );
}

async function AssessmentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const loaded = await loadPublishedAssessmentByCode(code);
  if (!loaded) {
    return (
      <div className="space-y-4">
        <PageHeader title="Assessment not found" purpose="This assessment is not published or does not exist." />
        <Button variant="outline" render={<Link href="/assessments" />}>Back to assessments</Button>
      </div>
    );
  }

  const { assessment, payload } = loaded;
  let attempt = await loadUserAttemptForAssessment(user.id, assessment.id);

  if (!attempt) {
    const started = await startAssessmentAttempt(assessment.id);
    if (started.ok) {
      attempt = await loadUserAttemptForAssessment(user.id, assessment.id);
    }
  }

  const confirmedResult =
    attempt?.status === "confirmed"
      ? await loadConfirmedPlacementResult(user.id, attempt.id)
      : null;

  if (confirmedResult?.confirmed_at) {
    const sectionScores = confirmedResult.section_scores as Record<string, number>;
    const confirmer = confirmedResult.profiles as { full_name: string | null; email: string } | null;
    return (
      <div className="space-y-6">
        <PageHeader title={payload.assessment.title} purpose="Your confirmed Week 0 placement." />
        <div className="rounded-lg border p-6 space-y-4">
          <p className="text-lg font-semibold">Stream: {streamLabel(confirmedResult.confirmed_stream)}</p>
          <p>Total score: {confirmedResult.total}</p>
          <div>
            <h3 className="font-medium">Section scores</h3>
            <ul className="list-disc pl-5 text-sm">
              {Object.entries(sectionScores).map(([section, score]) => (
                <li key={section}>{section}: {score}</li>
              ))}
            </ul>
          </div>
          {confirmedResult.bridges?.length ? (
            <p>Bridge modules: {confirmedResult.bridges.join(", ")}</p>
          ) : null}
          {confirmedResult.gates_failed?.length ? (
            <p>Gates noted: {confirmedResult.gates_failed.join(", ")}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Confirmed {new Date(confirmedResult.confirmed_at).toLocaleString()} by{" "}
            {confirmer?.full_name?.trim() || confirmer?.email || "your trainer"}.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/assessments" />}>Back to assessments</Button>
      </div>
    );
  }

  if (attempt && attempt.status !== "in_progress") {
    return (
      <div className="space-y-4">
        <PageHeader title={payload.assessment.title} purpose="Your attempt has been submitted." />
        <p className="text-sm text-muted-foreground">
          Trainers are marking written responses. You will see your placement result here after confirmation.
        </p>
        <Button variant="outline" render={<Link href="/assessments" />}>Back to assessments</Button>
      </div>
    );
  }

  const responses = attempt ? await loadAttemptResponses(attempt.id) : [];
  const initialAnswers: Record<string, Record<string, unknown>> = {};
  for (const row of responses) {
    initialAnswers[row.item_id] = row.answer as Record<string, unknown>;
  }

  const meta =
    attempt?.meta && typeof attempt.meta === "object" && !Array.isArray(attempt.meta)
      ? (attempt.meta as Record<string, unknown>)
      : {};

  return (
    <div className="space-y-6">
      <PageHeader title={payload.assessment.title} purpose="Work through each section. Answers save automatically." />
      {payload.assessment.instructionsMd ? <MarkdownView markdown={payload.assessment.instructionsMd} /> : null}
      {attempt ? (
        <AssessmentAttemptClient
          code={code}
          attemptId={attempt.id}
          payload={payload}
          initialAnswers={initialAnswers}
          meta={meta}
          timeGuideMin={payload.assessment.timeGuideMin}
          readOnly={false}
        />
      ) : (
        <p className="text-sm text-muted-foreground">The attempt could not be started. Try again or contact a trainer.</p>
      )}
    </div>
  );
}
