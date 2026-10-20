import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AcknowledgeBox } from "@/app/(app)/help/acknowledge-box";
import { MarkdownView } from "@/components/shared/markdown-view";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth";
import {
  formatDate,
  loadHelpPageBySlug,
  loadUserAcknowledgement,
} from "@/lib/content/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page: slug } = await params;
  const row = await loadHelpPageBySlug(slug);
  return { title: row?.title ?? "Rules and help" };
}

export default async function Page({ params }: { params: Promise<{ page: string }> }) {
  const user = await requireUser();
  const { page: slug } = await params;
  const page = await loadHelpPageBySlug(slug);
  if (!page) {
    notFound();
  }

  const ack =
    page.requires_acknowledgement
      ? await loadUserAcknowledgement(user.id, page.id, page.version)
      : null;

  const ownerName = (page as { profiles?: { full_name: string | null } }).profiles?.full_name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader title={page.title} purpose="Rules and help" />
      <MarkdownView markdown={page.body_md} />
      <footer className="border-t border-border pt-4 text-sm text-muted">
        Owner: {ownerName} · Version {page.version} · Updated {formatDate(page.published_at)}
        {page.review_by ? ` · Next review ${formatDate(page.review_by)}` : ""}
      </footer>
      {page.requires_acknowledgement ? (
        <AcknowledgeBox
          pageId={page.id}
          version={page.version}
          acknowledgedAt={ack?.acknowledged_at ?? null}
        />
      ) : null}
      <p className="text-sm">
        <Link href="/help" className="text-accent-strong underline underline-offset-2">
          Back to Rules and help
        </Link>
      </p>
    </div>
  );
}
