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
  loadUserAttemptsForAssessment,
  streamLabel,
} from "@/lib/assessments/queries";
import { attemptsRemaining, countCompletedAttempts, pickBestQuizAttempt } from "@/lib/assessments/quiz-status";
import { startAssessmentAttempt } from "@/app/(app)/assessments/attempt-actions";
import { AssessmentAttemptClient } from "@/app/(app)/assessments/assessment-attempt-client";
import { QuizResultClient } from "@/app/(app)/assessments/quiz-result-client";

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
  const initial = await loadPublishedAssessmentByCode(code);
  if (!initial) {
    return (
      <div className="space-y-4">
        <PageHeader title="Assessment not found" purpose="This assessment is not published or does not exist." />
        <Button variant="outline" render={<Link href="/assessments" />}>Back to assessments</Button>
      </div>
    );
  }

  const { assessment } = initial;
  const isQuiz = assessment.type === "quiz" || assessment.type === "safety_quiz";
  const attempts = await loadUserAttemptsForAssessment(user.id, assessment.id);
  let attempt = attempts.find((a) => a.status === "in_progress") ?? null;

  if (!attempt && isQuiz) {
    const completedCount = countCompletedAttempts(attempts);
    const remaining = attemptsRemaining(assessment.max_attempts, completedCount);
    if (remaining === null || remaining > 0) {
      const started = await startAssessmentAttempt(assessment.id);
      if (started.ok) {
        const refreshed = await loadUserAttemptsForAssessment(user.id, assessment.id);
        attempt = refreshed.find((a) => a.status === "in_progress") ?? null;
      }
    }
  } else if (!attempt && !isQuiz) {
    const started = await startAssessmentAttempt(assessment.id);
    if (started.ok) {
      const refreshed = await loadUserAttemptsForAssessment(user.id, assessment.id);
      attempt = refreshed[0] ?? null;
    }
  }

  if (!isQuiz) {
    const placementAttempt = attempts[0] ?? attempt;
    const confirmedResult =
      placementAttempt?.status === "confirmed"
        ? await loadConfirmedPlacementResult(user.id, placementAttempt.id)
        : null;

    if (confirmedResult?.confirmed_at) {
      const sectionScores = confirmedResult.section_scores as Record<string, number>;
      const confirmer = confirmedResult.profiles as { full_name: string | null; email: string } | null;
      return (
        <div className="space-y-6">
          <PageHeader title={initial.payload.assessment.title} purpose="Your confirmed Week 0 placement." />
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

    if (placementAttempt && placementAttempt.status !== "in_progress") {
      return (
        <div className="space-y-4">
          <PageHeader title={initial.payload.assessment.title} purpose="Your attempt has been submitted." />
          <p className="text-sm text-muted-foreground">
            Trainers are marking written responses. You will see your placement result here after confirmation.
          </p>
          <Button variant="outline" render={<Link href="/assessments" />}>Back to assessments</Button>
        </div>
      );
    }

    attempt = placementAttempt;
  }

  const loaded = await loadPublishedAssessmentByCode(code, attempt);
  const payload = loaded?.payload ?? initial.payload;

  if (isQuiz && !attempt) {
    const completed = attempts.filter((a) => a.status !== "in_progress");
    const best = pickBestQuizAttempt(
      completed.map((a) => ({
        percentage: a.percentage,
        passed: a.passed,
        submittedAt: a.submitted_at,
      })),
    );
    const latestCompleted = completed[0];
    const showAttempt = latestCompleted ?? null;
    if (showAttempt && showAttempt.submitted_at) {
      const itemCount = showAttempt.item_ids?.length ?? payload.sections.flatMap((s) => s.items).length;
      const pct = showAttempt.percentage ?? 0;
      const correct = Math.round((pct / 100) * itemCount);
      return (
        <div className="space-y-6">
          <PageHeader title={payload.assessment.title} purpose="Your quiz result." />
          <QuizResultClient
            attemptId={showAttempt.id}
            scoreLabel={`${correct} of ${itemCount} (${Math.round(pct)}%)`}
            passed={Boolean(best?.passed)}
            passMarkPct={assessment.pass_mark_pct}
          />
          <Button variant="outline" render={<Link href="/assessments" />}>Back to assessments</Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <PageHeader title={payload.assessment.title} purpose="No attempts remaining." />
        <p className="text-sm text-muted-foreground">
          You have used all allowed attempts for this quiz. Your trainer can grant a retake if needed.
        </p>
        <Button variant="outline" render={<Link href="/assessments" />}>Back to assessments</Button>
      </div>
    );
  }

  if (isQuiz && attempt && attempt.status !== "in_progress") {
    const itemCount = attempt.item_ids?.length ?? payload.sections.flatMap((s) => s.items).length;
    const pct = attempt.percentage ?? 0;
    const correct = Math.round((pct / 100) * itemCount);
    return (
      <div className="space-y-6">
        <PageHeader title={payload.assessment.title} purpose="Your quiz result." />
        <QuizResultClient
          attemptId={attempt.id}
          scoreLabel={`${correct} of ${itemCount} (${Math.round(pct)}%)`}
          passed={Boolean(attempt.passed)}
          passMarkPct={assessment.pass_mark_pct}
        />
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
      <PageHeader
        title={payload.assessment.title}
        purpose={
          isQuiz
            ? "Answer every question on this page. Your answers save automatically."
            : "Work through each section. Answers save automatically."
        }
      />
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
          variant={isQuiz ? "quiz" : "placement"}
          passMarkPct={assessment.pass_mark_pct}
        />
      ) : (
        <p className="text-sm text-muted-foreground">The attempt could not be started. Try again or contact a trainer.</p>
      )}
    </div>
  );
}
