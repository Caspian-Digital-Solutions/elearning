import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpList } from "@/app/(app)/help/help-list";
import { loadPublishedHelpPages, teaserFromMarkdown } from "@/lib/content/queries";
import { helpPageUpdatedLabel } from "@/lib/content/help-footer";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Rules and help",
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-64" aria-busy="true" aria-label="Loading help" />}>
      <HelpPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HelpPageContent({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await connection();
  await requireUser();
  const { q } = await searchParams;
  const pages = await loadPublishedHelpPages(q);
  const items = pages.map((page) => ({
    slug: page.slug,
    title: page.title,
    teaser: teaserFromMarkdown(page.body_md),
    version: page.version,
    updatedLabel: helpPageUpdatedLabel(page.published_at),
  }));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rules and help"
        purpose="Data rules, risk tiers, glossary, FAQ and who to ask."
      />
      <HelpList pages={items} initialQuery={q} />
    </div>
  );
}
