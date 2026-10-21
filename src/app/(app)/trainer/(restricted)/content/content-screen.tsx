"use client";

import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageListRow, UpdateListRow } from "@/lib/content/queries";
import type { LessonListRow } from "@/lib/lessons/queries";
import { LessonImportDialog } from "@/app/(app)/trainer/(restricted)/content/lesson-import-dialog";

export function ContentScreen({
  pages,
  updates,
  lessons,
  defaultTab = "pages",
}: {
  pages: PageListRow[];
  updates: UpdateListRow[];
  lessons: LessonListRow[];
  defaultTab?: "pages" | "updates" | "lessons";
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        purpose="Write, preview and publish help pages, What changed notes and lessons."
      />
      <Tabs defaultValue={defaultTab}>
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
        <TabsContent value="lessons" className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <LessonImportDialog />
            <Button render={<Link href="/trainer/content/lessons/new" />}>New lesson</Button>
          </div>
          {lessons.length === 0 ? (
            <EmptyState title="No lessons yet" description="Create a lesson or import Markdown drafts." />
          ) : (
            <DataTable
              rowKey="id"
              columns={[
                { key: "moduleCode", header: "Module" },
                { key: "moduleTitle", header: "Module title" },
                { key: "title", header: "Lesson" },
                { key: "kindLabel", header: "Kind" },
                { key: "statusLabel", header: "Status" },
                { key: "version", header: "Version" },
                { key: "departments", header: "Departments", wrap: true },
                { key: "duration", header: "Duration" },
                { key: "completions", header: "Completions" },
                { key: "lastPublished", header: "Last published" },
              ]}
              rows={lessons}
              caption="Lessons"
              exportFileName="lessons.csv"
              filters={[
                { key: "stage", label: "Stage" },
                { key: "moduleCode", label: "Module" },
                { key: "kindLabel", label: "Kind" },
                { key: "statusLabel", label: "Status" },
                { key: "departments", label: "Department" },
              ]}
              rowActions={(row) => (
                <div className="flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" render={<Link href={`/trainer/content/lessons/${row.id}`} />}>
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/trainer/content/modules/${row.moduleCode.toLowerCase()}`} />}
                  >
                    Module
                  </Button>
                </div>
              )}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
