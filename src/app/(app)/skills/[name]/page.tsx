import { Suspense } from "react";
import type { Metadata } from "next";
import { displayParam } from "@/config/navigation";
import { DetailSection } from "@/components/shared/detail-section";

export const metadata: Metadata = {
  title: "Skills catalogue",
};

export default function Page({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading.</p>}>
      <DetailSection
        section="skills"
        params={params}
        crumbs={(value) => [
          { href: "/skills", label: "Skills catalogue" },
          { label: displayParam(value.name) },
        ]}
      />
    </Suspense>
  );
}
