import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { loadLearnerAssessmentCards } from "@/lib/assessments/queries";

export const metadata: Metadata = {
  title: "Assessments",
};

export default async function Page() {
  const user = await requireUser();
  const cards = await loadLearnerAssessmentCards(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        purpose="Week 0 placement and module quizzes. Complete Week 0 before your personalised learning path is built."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Card key={card.code}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{card.instructionsSnippet || "Placement assessment"}</p>
              <p>
                <span className="font-medium">Status:</span> {card.statusLabel}
              </p>
              {card.timeGuideMin ? (
                <p>
                  <span className="font-medium">Guide time:</span> about {card.timeGuideMin} minutes
                </p>
              ) : null}
              {card.href ? (
                <Button render={<Link href={card.href} />}>
                  {card.statusLabel === "Not started" ? "Start" : "Continue"}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>Module quizzes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Coming in Prompt 07b — module safety quizzes and capstones will appear here.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
