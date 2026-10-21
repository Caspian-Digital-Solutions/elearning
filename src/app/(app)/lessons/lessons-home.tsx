"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatModuleProgress } from "@/lib/lessons/progress";
import type { LearnerModuleCard } from "@/lib/lessons/queries";

export function LessonsHome({
  cards,
  showAllDefault,
}: {
  cards: LearnerModuleCard[];
  showAllDefault: boolean;
}) {
  const [showAll, setShowAll] = useState(showAllDefault);

  const visible = useMemo(() => {
    if (showAll) {
      return cards;
    }
    return cards.filter((card) => !card.hiddenByDefault);
  }, [cards, showAll]);

  const groups = useMemo(() => {
    const leadership = visible.filter((c) => c.isLeadership);
    const programme = visible.filter((c) => !c.isLeadership);
    const byStage = new Map<string, LearnerModuleCard[]>();
    for (const card of programme) {
      const list = byStage.get(card.stageName) ?? [];
      list.push(card);
      byStage.set(card.stageName, list);
    }
    return {
      leadership,
      stages: [...byStage.entries()].sort((a, b) => a[1][0]!.stageSort - b[1][0]!.stageSort),
    };
  }, [visible]);

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
        Show lessons for all departments
      </label>
      {groups.stages.map(([stageName, stageCards]) => (
        <section key={stageName} className="space-y-3">
          <h2 className="font-heading text-lg text-heading">{stageName}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {stageCards.map((card) => (
              <ModuleCard key={card.code} card={card} showAll={showAll} />
            ))}
          </ul>
        </section>
      ))}
      {groups.leadership.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-lg text-heading">Leadership briefings</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {groups.leadership.map((card) => (
              <ModuleCard key={card.code} card={card} showAll={showAll} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ModuleCard({ card, showAll }: { card: LearnerModuleCard; showAll: boolean }) {
  const href = `/lessons/${card.code.toLowerCase()}`;
  const progress = formatModuleProgress(card.completedCount, card.publishedCount);
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-sm text-muted">{card.code}</span>
        {showAll && card.departmentLabels.length > 0 ? (
          <span className="text-xs text-muted">{card.departmentLabels.join(", ")}</span>
        ) : null}
      </div>
      <h3 className="font-heading text-base text-heading">{card.title}</h3>
      <p className="mt-1 text-sm text-muted">
        {card.weekLabel} · {card.liveHours} · {card.assessedBy}
      </p>
      <p className="mt-2 text-sm">
        {card.publishedCount === 0
          ? "Lessons coming soon"
          : `${card.publishedCount} lesson${card.publishedCount === 1 ? "" : "s"} · ${progress}`}
      </p>
      <Button className="mt-3" size="sm" variant="outline" render={<Link href={href} />}>
        Open module
      </Button>
    </li>
  );
}
