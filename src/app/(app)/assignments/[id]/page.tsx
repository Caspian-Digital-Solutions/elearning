import { Suspense } from "react";
import type { Metadata } from "next";
import { DetailSection, labelled } from "@/components/shared/detail-section";

export const metadata: Metadata = {
  title: "Assignments",
};

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading.</p>}>
      <DetailSection
        section="assignments"
        params={params}
        crumbs={(value) => [
          { href: "/assignments", label: "Assignments" },
          { label: labelled(value.id, "Assignment") },
        ]}
      />
    </Suspense>
  );
}
