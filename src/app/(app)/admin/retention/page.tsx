import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { authorise } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Retention",
};

type RetentionRow = {
  name: string;
  email: string;
  leftAt: string;
  retentionEnds: string;
};

const columns: DataColumn<RetentionRow>[] = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "leftAt", header: "Left date" },
  { key: "retentionEnds", header: "Retention ends" },
];

export default function RetentionPage() {
  return (
    <>
      <PageHeader
        title="Retention"
        purpose="People whose proposed retention period (12 months after leaving) has ended. Review before any manual deletion."
      />
      <Suspense fallback={<Skeleton className="h-64" aria-busy="true" aria-label="Loading retention list" />}>
        <RetentionData />
      </Suspense>
    </>
  );
}

async function RetentionData() {
  const user = await authorise(["admin"]);
  if (!user) {
    return null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, email, left_at")
    .not("left_at", "is", null)
    .eq("is_test_account", false)
    .order("left_at");
  if (error) {
    return <p className="text-sm text-destructive">The retention list could not be loaded.</p>;
  }
  const today = new Date();
  const rows: RetentionRow[] = (data ?? [])
    .map((row) => {
      const left = row.left_at ? new Date(`${row.left_at}T00:00:00Z`) : null;
      if (!left) {
        return null;
      }
      const ends = new Date(left);
      ends.setUTCMonth(ends.getUTCMonth() + 12);
      if (ends > today) {
        return null;
      }
      return {
        name: row.full_name?.trim() || row.email,
        email: row.email,
        leftAt: row.left_at ?? "—",
        retentionEnds: ends.toISOString().slice(0, 10),
      };
    })
    .filter((row): row is RetentionRow => row !== null);

  return (
    <DataTable
      columns={columns}
      rows={rows}
      caption="Retention period ended"
      exportFileName="retention-ended.csv"
      emptyMessage="Nobody is past the retention period yet."
    />
  );
}
