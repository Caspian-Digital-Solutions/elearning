import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { HelpList } from "@/app/(app)/help/help-list";
import { loadPublishedHelpPages, teaserFromMarkdown, formatDate } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Rules and help",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const pages = await loadPublishedHelpPages(q);
  const items = pages.map((page) => ({
    slug: page.slug,
    title: page.title,
    teaser: teaserFromMarkdown(page.body_md),
    version: page.version,
    updatedLabel: formatDate(page.published_at ?? page.updated_at),
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
