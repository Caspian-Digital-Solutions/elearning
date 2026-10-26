import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { authorise } from "@/lib/auth";
import { loadPlatformInfo } from "@/lib/system/platform-info";

export const metadata: Metadata = {
  title: "System",
};

export default async function AdminSystemPage() {
  if (!(await authorise(["admin"]))) {
    return null;
  }
  const info = await loadPlatformInfo();

  return (
    <>
      <PageHeader
        title="System"
        purpose="Environment and deployment facts for cut-over checks. No secret keys are shown here."
      />
      <dl className="mt-6 max-w-xl space-y-4 text-sm">
        <div className="flex flex-col gap-1 border-b border-border pb-3">
          <dt className="text-muted-foreground">Environment</dt>
          <dd className="font-medium text-heading">{info.environment}</dd>
        </div>
        <div className="flex flex-col gap-1 border-b border-border pb-3">
          <dt className="text-muted-foreground">Supabase project ref</dt>
          <dd className="font-mono text-heading">{info.projectRef}</dd>
          <dd className="text-muted-foreground">Short: {info.projectRefShort}</dd>
        </div>
        <div className="flex flex-col gap-1 border-b border-border pb-3">
          <dt className="text-muted-foreground">App version (git commit)</dt>
          <dd className="font-mono text-heading">{info.gitCommit}</dd>
        </div>
        <div className="flex flex-col gap-1 border-b border-border pb-3">
          <dt className="text-muted-foreground">Latest applied migration</dt>
          <dd className="font-mono text-heading">{info.latestMigration}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">Sample content allowed</dt>
          <dd className="font-medium text-heading">{info.sampleContentAllowed ? "Yes" : "No"}</dd>
        </div>
      </dl>
      <p className="mt-8 max-w-xl text-sm text-muted-foreground">
        Backup admin for production role changes:{" "}
        <span className="font-mono text-foreground">admin@caspiands.com</span> (not the misspelled
        caspainds.com address).
      </p>
    </>
  );
}
