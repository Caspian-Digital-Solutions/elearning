import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownView } from "@/components/shared/markdown-view";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { loadUpdateBySlug } from "@/lib/content/queries";
import { formatDate } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const row = await loadUpdateBySlug(slug);
  return { title: row?.title ?? "What changed" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const update = await loadUpdateBySlug(slug);
  if (!update || !update.slug) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader title={update.title} purpose={formatDate(update.published_at)} />
      <div className="flex flex-wrap gap-2">
        {(update.tools ?? []).map((tool) => (
          <Badge key={tool} variant="outline">{tool}</Badge>
        ))}
      </div>
      {update.action_required && update.action_due ? (
        <p className="text-sm">
          Action required by {formatDate(update.action_due)}
          {update.action_text ? `: ${update.action_text}` : ""}
        </p>
      ) : null}
      <MarkdownView markdown={update.body_md} />
      <Link href="/what-changed" className="text-sm text-accent-strong underline underline-offset-2">
        Back to What changed
      </Link>
    </div>
  );
}
