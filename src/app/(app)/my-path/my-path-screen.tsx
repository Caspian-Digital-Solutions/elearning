import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { formatDateTime } from "@/lib/format";
import type { MyPathState, PlanModuleRow } from "@/lib/plan/queries";

function ModuleList({
  rows,
  empty,
  showDue = true,
  f7TimeLog,
}: {
  rows: PlanModuleRow[];
  empty: string;
  showDue?: boolean;
  f7TimeLog?: { logged: number; required: number } | null;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.moduleId} className="rounded-lg border border-border p-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link href={row.href} className="font-medium text-accent-strong underline underline-offset-2">
              {row.code} — {row.title}
            </Link>
            {showDue && row.dueDateLabel ? <span className="text-muted-foreground">{row.dueDateLabel}</span> : null}
          </div>
          <p className="mt-1 text-muted-foreground">
            Lessons {row.lessonsDone} of {row.lessonsTotal} done
            {row.quizLabel ? ` · ${row.quizLabel}` : ""}
            {row.code === "F7" && f7TimeLog ? (
              <>
                {" "}
                ·{" "}
                <Link href="/progress" className="text-accent-strong underline underline-offset-2">
                  Time logs: {f7TimeLog.logged} of {f7TimeLog.required} tasks
                </Link>
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function MyPathScreen({ state }: { state: MyPathState }) {
  if (state.kind === "no_week0") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My path"
          purpose="Your stream, cohort calendar, and what to work on each week — built after Week 0 is confirmed."
        />
        <Card>
          <CardHeader>
            <CardTitle>Step 1 — Sit the Week 0 assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Week 0 finds the right stream for you and any bridge modules to revisit. It mixes multiple-choice,
              scenarios and practical tasks marked by a trainer.
            </p>
            {state.timeGuideMin ? (
              <p className="text-muted-foreground">Allow about {state.timeGuideMin} minutes.</p>
            ) : null}
            <Link
              href={state.href}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Go to {state.title}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.kind === "awaiting_confirmation") {
    return (
      <div className="space-y-6">
        <PageHeader title="My path" purpose="Your personalised plan appears once a trainer confirms your stream." />
        <p className="text-sm">
          Your answers are being marked. Your plan appears once a trainer confirms your stream.
          {state.submittedAtLabel ? (
            <>
              {" "}
              Submitted <span className="whitespace-nowrap">{state.submittedAtLabel}</span>.
            </>
          ) : null}
        </p>
      </div>
    );
  }

  const { plan } = state;
  const weekLine =
    plan.programmeWeek !== null
      ? `Week ${plan.programmeWeek} of 12`
      : plan.programmeWeekLine || (plan.cohortName ? "Cohort dates not set yet" : "");

  return (
    <div className="space-y-6">
      <PageHeader
        title="My path"
        purpose={`${plan.streamLabel}${plan.cohortName ? ` · ${plan.cohortName}` : ""}${weekLine ? ` · ${weekLine}` : ""}`}
      />
      <p className="text-sm">
        Required modules: {plan.requiredDone} of {plan.requiredTotal} done
      </p>

      <section className="space-y-2">
        <h2 className="font-heading text-lg text-heading">This week</h2>
        <ModuleList rows={plan.thisWeek} empty="Nothing due this programme week." f7TimeLog={plan.f7TimeLog} />
      </section>

      {plan.bridges.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-heading text-lg text-heading">Bridge modules</h2>
          <p className="text-sm text-muted-foreground">From your Week 0 result — complete these by the due date.</p>
          <ModuleList rows={plan.bridges} empty="" />
        </section>
      ) : null}

      {plan.testOuts.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-heading text-lg text-heading">Test-out</h2>
          <ul className="space-y-3 text-sm">
            {plan.testOuts.map((card) => (
              <li key={card.code} className="rounded-lg border border-border p-3">
                <p className="font-medium">{card.headline}</p>
                {card.detail ? <p className="mt-1 text-muted-foreground">{card.detail}</p> : null}
                {card.kind === "active" && card.href ? (
                  <Link
                    href={card.href}
                    className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                  >
                    Start
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {plan.week5TestOutNote ? (
        <section className="space-y-2">
          <h2 className="font-heading text-lg text-heading">Fast track</h2>
          <p className="text-sm text-muted-foreground">{plan.week5TestOutNote}</p>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-heading text-lg text-heading">Coming up</h2>
        <ModuleList rows={plan.comingUp} empty="Next week's modules will show here when your cohort calendar is set." />
      </section>

      {plan.overdue.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-heading text-lg text-heading">Overdue</h2>
          <ul className="space-y-2 text-sm">
            {plan.overdue.map((row) => (
              <li key={row.moduleId}>
                <span className="font-medium">Overdue</span> —{" "}
                <Link href={row.href} className="text-accent-strong underline underline-offset-2">
                  {row.code}
                </Link>
                {row.dueDateLabel ? ` (${row.dueDateLabel.replace("Due ", "")})` : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-heading text-lg text-heading">You may skip</h2>
        <p className="text-sm text-muted-foreground">Tested-out modules. You can still open these.</p>
        <ModuleList rows={plan.maySkip} empty="No tested-out modules on your plan." showDue={false} />
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg text-heading">Done</h2>
        <ul className="space-y-2 text-sm">
          {plan.done.length === 0 ? (
            <li className="text-muted-foreground">Completed modules will appear here.</li>
          ) : (
            plan.done.map((row) => (
              <li key={row.moduleId}>
                <Link href={row.href} className="text-accent-strong underline underline-offset-2">
                  {row.code} — {row.title}
                </Link>
                {row.completedAt ? (
                  <span className="text-muted-foreground"> · {formatDateTime(row.completedAt)}</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg text-heading">Optional</h2>
        <ModuleList rows={plan.optional} empty="No optional modules on your plan." />
      </section>
    </div>
  );
}
