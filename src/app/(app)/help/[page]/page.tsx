import { Suspense } from "react";
import type { Metadata } from "next";
import { displayParam } from "@/config/navigation";
import { DetailSection } from "@/components/shared/detail-section";

export const metadata: Metadata = {
  title: "Rules and help",
};

export default function Page({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading.</p>}>
      <DetailSection
        section="help"
        params={params}
        crumbs={(value) => [
          { href: "/help", label: "Rules and help" },
          { label: displayParam(value.page) },
        ]}
      />
    </Suspense>
  );
}
