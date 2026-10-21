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
import { AssessmentImportDialog } from "@/app/(app)/trainer/(restricted)/content/assessment-import-dialog";
import { AssessmentPreviewDialog } from "@/app/(app)/trainer/(restricted)/content/assessment-preview-dialog";
import type { TrainerAssessmentListRow } from "@/lib/assessments/queries";
import { publishAssessment } from "@/app/(app)/trainer/(restricted)/content/assessment-actions";

export function ContentScreen({
  pages,
  updates,
  lessons,
  assessments,
  defaultTab = "pages",
}: {
  pages: PageListRow[];
  updates: UpdateListRow[];
  lessons: LessonListRow[];
  assessments: TrainerAssessmentListRow[];
  defaultTab?: "pages" | "updates" | "lessons" | "assessments";
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
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
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
        <TabsContent value="assessments" className="space-y-4">
          <div className="flex justify-end">
            <AssessmentImportDialog />
          </div>
          <DataTable
            rowKey="id"
            columns={[
              { key: "code", header: "Code" },
              { key: "title", header: "Title" },
              { key: "typeLabel", header: "Type" },
              { key: "moduleCode", header: "Module" },
              { key: "passMarkPct", header: "Pass mark" },
              { key: "maxAttempts", header: "Max attempts" },
              { key: "itemsPerAttempt", header: "Items per attempt" },
              { key: "version", header: "Version" },
              { key: "statusLabel", header: "Status" },
              { key: "sampleLabel", header: "Sample" },
              { key: "itemCount", header: "Items" },
              { key: "attemptCount", header: "Attempts" },
            ]}
            rows={assessments.map((row) => ({
              id: row.id,
              code: row.code,
              title: row.title,
              typeLabel: row.typeLabel,
              moduleCode: row.moduleCode,
              passMarkPct: row.passMarkPct,
              maxAttempts: row.maxAttempts,
              itemsPerAttempt: row.itemsPerAttempt,
              version: String(row.version),
              statusLabel: row.statusLabel,
              sampleLabel: row.isSample ? "Yes" : "No",
              itemCount: String(row.itemCount),
              attemptCount: String(row.attemptCount),
            }))}
            caption="Assessments"
            exportFileName="assessments.csv"
            filters={[{ key: "statusLabel", label: "Status" }, { key: "typeLabel", label: "Type" }]}
            rowActions={(row) => (
              <div className="flex flex-wrap gap-1">
                <AssessmentPreviewDialog assessmentId={row.id} />
                {row.statusLabel === "Draft" ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      void publishAssessment({ id: row.id, changeNote: "Published from content screen." }).then(
                        (result) => {
                          if (result.ok) {
                            window.location.reload();
                          }
                        },
                      )
                    }
                  >
                    Publish
                  </Button>
                ) : null}
              </div>
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
