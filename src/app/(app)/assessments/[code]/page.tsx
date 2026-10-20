import { Suspense } from "react";
import type { Metadata } from "next";
import { DetailSection, labelled } from "@/components/shared/detail-section";

export const metadata: Metadata = {
  title: "Assessments",
};

export default function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading.</p>}>
      <DetailSection
        section="assessments"
        params={params}
        crumbs={(value) => [
          { href: "/assessments", label: "Assessments" },
          { label: labelled(value.code, "Assessment") },
        ]}
      />
    </Suspense>
  );
}
