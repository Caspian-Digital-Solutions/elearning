import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { MarkdownView } from "@/components/shared/markdown-view";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatKindLabel, loadLearnerModuleByCode } from "@/lib/lessons/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}): Promise<Metadata> {
  const { module: code } = await params;
  const data = await loadLearnerModuleByCode(code);
  return { title: data ? `${data.module.code} — ${data.module.title}` : "Lessons" };
}

export default async function Page({ params }: { params: Promise<{ module: string }> }) {
  const user = await requireUser();
  const { module: code } = await params;
  const data = await loadLearnerModuleByCode(code);
  if (!data) {
    notFound();
  }

  const supabase = await createClient();
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", user.id);
  const completed = new Set((progress ?? []).map((row) => row.lesson_id));

  const stage = data.module.stages as { name: string } | null;
  const weeks =
    data.module.week_start === data.module.week_end
      ? `Week ${data.module.week_start}`
      : `Weeks ${data.module.week_start}–${data.module.week_end}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${data.module.code} — ${data.module.title}`}
        purpose={`${stage?.name ?? "Module"} · ${weeks} · ${data.module.live_hours}h live · Assessed by ${data.module.assessed_by ?? "—"}`}
      />
      {data.domainNames.length > 0 ? (
        <p className="text-sm text-muted">Domains: {data.domainNames.join(", ")}</p>
      ) : null}
      {data.module.overview_md ? (
        <div className="max-w-3xl overflow-x-auto">
          <MarkdownView markdown={data.module.overview_md} />
        </div>
      ) : null}
      <section className="space-y-2">
        <h2 className="font-heading text-lg text-heading">Lessons</h2>
        {data.lessons.length === 0 ? (
          <p className="text-sm text-muted">Lessons coming soon.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {data.lessons.map((lesson) => (
              <li key={lesson.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <Link
                  href={`/lessons/${code.toLowerCase()}/${lesson.slug}`}
                  className="font-medium text-accent-strong underline underline-offset-2"
                >
                  {lesson.title}
                </Link>
                <span className="text-muted">{formatKindLabel(lesson.kind)}</span>
                {lesson.duration_min ? <span className="text-muted">{lesson.duration_min} min</span> : null}
                {completed.has(lesson.id) ? <span aria-label="Completed">✓</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-sm">
        <Link href="/lessons" className="text-accent-strong underline underline-offset-2">Back to all modules</Link>
      </p>
    </div>
  );
}
