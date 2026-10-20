"use client";

import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageListRow, UpdateListRow } from "@/lib/content/queries";

export function ContentScreen({
  pages,
  updates,
}: {
  pages: PageListRow[];
  updates: UpdateListRow[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        purpose="Write, preview and publish help pages and What changed notes."
      />
      <Tabs defaultValue="pages">
        <TabsList>
          <TabsTrigger value="pages">Help pages</TabsTrigger>
          <TabsTrigger value="updates">What changed</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
        </TabsList>
        <TabsContent value="pages" className="space-y-4">
          <div className="flex justify-end">
            <Button render={<Link href="/trainer/content/pages/new" />}>New page</Button>
          </div>
          <DataTable
            rowKey="id"
            columns={[
              { key: "title", header: "Title" },
              { key: "statusLabel", header: "Status" },
              { key: "version", header: "Version" },
              { key: "owner", header: "Owner" },
              { key: "reviewBy", header: "Review by" },
              { key: "lastPublished", header: "Last published" },
              { key: "acknowledgements", header: "Acknowledgements", wrap: true },
            ]}
            rows={pages}
            caption="Help pages"
            exportFileName="help-pages.csv"
            rowActions={(row) => (
              <Button variant="outline" size="sm" render={<Link href={`/trainer/content/pages/${row.id}`} />}>
                Edit
              </Button>
            )}
            filters={[
              { key: "statusLabel", label: "Status" },
              { key: "owner", label: "Owner" },
            ]}
          />
        </TabsContent>
        <TabsContent value="updates" className="space-y-4">
          <div className="flex justify-end">
            <Button render={<Link href="/trainer/content/updates/new" />}>New update</Button>
          </div>
          <DataTable
            rowKey="id"
            columns={[
              { key: "title", header: "Title" },
              { key: "tools", header: "Tools" },
              { key: "actionRequired", header: "Action required" },
              { key: "due", header: "Due" },
              { key: "statusLabel", header: "Status" },
              { key: "published", header: "Published" },
            ]}
            rows={updates}
            caption="What changed updates"
            exportFileName="what-changed.csv"
            rowActions={(row) => (
              <Button variant="outline" size="sm" render={<Link href={`/trainer/content/updates/${row.id}`} />}>
                Edit
              </Button>
            )}
            filters={[{ key: "statusLabel", label: "Status" }]}
          />
        </TabsContent>
        <TabsContent value="lessons">
          <EmptyState
            title="Lessons"
            description="Built in Prompt 06."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
