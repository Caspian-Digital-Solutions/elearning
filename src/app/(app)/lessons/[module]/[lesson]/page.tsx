import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonCompleteBox } from "@/app/(app)/lessons/lesson-complete-box";
import { MarkdownView } from "@/components/shared/markdown-view";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth";
import { formatKindLabel, loadLearnerLesson } from "@/lib/lessons/queries";
import { videoEmbedUrl } from "@/lib/markdown/video-embed";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string; lesson: string }>;
}): Promise<Metadata> {
  const { module: moduleCode, lesson: lessonSlug } = await params;
  const data = await loadLearnerLesson(moduleCode, lessonSlug, "00000000-0000-0000-0000-000000000000");
  return { title: data?.lesson.title ?? "Lesson" };
}

export default async function Page({
  params,
}: {
  params: Promise<{ module: string; lesson: string }>;
}) {
  const user = await requireUser();
  const { module: moduleCode, lesson: lessonSlug } = await params;
  const data = await loadLearnerLesson(moduleCode, lessonSlug, user.id);
  if (!data) {
    notFound();
  }

  const embed = data.lesson.video_url ? videoEmbedUrl(data.lesson.video_url) : null;
  const resources = (data.lesson.resources as { title: string; url: string }[] | null) ?? [];

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/lessons" className="underline underline-offset-2">Lessons</Link>
        {" / "}
        <Link href={`/lessons/${moduleCode.toLowerCase()}`} className="underline underline-offset-2">
          {data.module.code}
        </Link>
        {" / "}
        <span>{data.lesson.title}</span>
      </nav>
      <PageHeader
        title={data.lesson.title}
        purpose={`${formatKindLabel(data.lesson.kind)}${data.lesson.duration_min ? ` · ${data.lesson.duration_min} min` : ""}`}
      />
      {embed ? (
        <div className="max-w-full overflow-x-auto">
          <div className="aspect-video w-full max-w-3xl">
            <iframe
              src={embed}
              title="Lesson video"
              className="h-full w-full rounded-lg border border-border"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}
      <div className="max-w-3xl overflow-x-auto">
        <MarkdownView markdown={data.lesson.body_md} />
      </div>
      {resources.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-heading text-base text-heading">Resources</h2>
          <ul className="list-disc pl-5 text-sm">
            {resources.map((resource) => (
              <li key={resource.url}>
                <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-accent-strong underline">
                  {resource.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <LessonCompleteBox
        lessonId={data.lesson.id}
        completedAt={data.progress?.completed_at ?? null}
        lessonVersion={data.lesson.version}
        storedVersion={data.progress?.lesson_version ?? null}
      />
      <div className="flex flex-wrap gap-4 text-sm">
        {data.prev ? (
          <Link
            href={`/lessons/${moduleCode.toLowerCase()}/${data.prev.slug}`}
            className="text-accent-strong underline underline-offset-2"
          >
            ← {data.prev.title}
          </Link>
        ) : null}
        {data.next ? (
          <Link
            href={`/lessons/${moduleCode.toLowerCase()}/${data.next.slug}`}
            className="ml-auto text-accent-strong underline underline-offset-2"
          >
            {data.next.title} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
