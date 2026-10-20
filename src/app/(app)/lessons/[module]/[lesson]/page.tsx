import { Suspense } from "react";
import type { Metadata } from "next";
import { DetailSection, labelled } from "@/components/shared/detail-section";

export const metadata: Metadata = {
  title: "Lessons",
};

export default function Page({
  params,
}: {
  params: Promise<{ module: string; lesson: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading.</p>}>
      <DetailSection
        section="lessons"
        params={params}
        crumbs={(value) => [
          { href: "/lessons", label: "Lessons" },
          { href: `/lessons/${value.module}`, label: labelled(value.module, "Module") },
          { label: labelled(value.lesson, "Lesson") },
        ]}
      />
    </Suspense>
  );
}
