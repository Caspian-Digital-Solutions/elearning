import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { WhatChangedFeed } from "@/app/(app)/what-changed/what-changed-feed";
import { markWhatChangedSeen } from "@/app/(app)/trainer/(restricted)/content/actions";
import { loadPublishedUpdates } from "@/lib/content/queries";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "What changed",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string; action?: string }>;
}) {
  const { tool, action } = await searchParams;
  await markWhatChangedSeen();
  const updates = await loadPublishedUpdates({
    tool: tool || undefined,
    actionOnly: action === "1",
  });
  const items = updates
    .filter((row) => row.slug)
    .map((row) => ({
      slug: row.slug as string,
      title: row.title,
      date: formatDate(row.published_at),
      tools: row.tools ?? [],
      actionRequired: row.action_required,
      actionText: row.action_text,
      actionDue: row.action_due,
    }));

  return (
    <div className="space-y-6">
      <PageHeader title="What changed" purpose="Weekly tool-change notes from trainers." />
      <WhatChangedFeed items={items} tool={tool} actionOnly={action === "1"} />
    </div>
  );
}
