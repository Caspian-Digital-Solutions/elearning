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
import type { TrainerAssignmentListRow } from "@/lib/assignments/queries";
import type { TrainerPromptListRow } from "@/lib/prompts/queries";
import type { DepartmentCertificationRow, SkillApprovalQueueItem, TrainerSkillListRow } from "@/lib/skills/queries";
import { SkillApprovalPanel } from "@/app/(app)/trainer/(restricted)/content/skill-approval-panel";
import { SkillCertificationPanel } from "@/app/(app)/trainer/(restricted)/content/skill-certification-panel";
import { publishAssessment } from "@/app/(app)/trainer/(restricted)/content/assessment-actions";
import { AssignmentImportDialog } from "@/app/(app)/trainer/(restricted)/content/assignment-import-dialog";
import { publishAssignment } from "@/app/(app)/trainer/(restricted)/content/assignment-actions";
import { PromptImportDialog } from "@/app/(app)/trainer/(restricted)/content/prompt-import-dialog";
import { PromptReviewPanel } from "@/app/(app)/trainer/(restricted)/content/prompt-review-panel";

export function ContentScreen({
  pages,
  updates,
  lessons,
  assessments,
  assignments,
  prompts,
  reviewQueue,
  promptImportCodes,
  skills,
  skillApprovalQueue,
  certificationEvidence,
  championOnly = false,
  defaultTab = "pages",
}: {
  pages: PageListRow[];
  updates: UpdateListRow[];
  lessons: LessonListRow[];
  assessments: TrainerAssessmentListRow[];
  assignments: TrainerAssignmentListRow[];
  prompts: TrainerPromptListRow[];
  reviewQueue: {
    id: string;
    title: string;
    submit_notes_md: string | null;
    submitter: { full_name: string | null } | null;
  }[];
  promptImportCodes: { departmentCodes: string[]; moduleCodes: string[] };
  skills: TrainerSkillListRow[];
  skillApprovalQueue: SkillApprovalQueueItem[];
  certificationEvidence: DepartmentCertificationRow[];
  championOnly?: boolean;
  defaultTab?: "pages" | "updates" | "lessons" | "assessments" | "assignments" | "prompts" | "skills";
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        purpose="Write, preview and publish help pages, What changed notes and lessons."
      />
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {!championOnly ? <TabsTrigger value="pages">Help pages</TabsTrigger> : null}
          {!championOnly ? <TabsTrigger value="updates">What changed</TabsTrigger> : null}
          {!championOnly ? <TabsTrigger value="lessons">Lessons</TabsTrigger> : null}
          {!championOnly ? <TabsTrigger value="assessments">Assessments</TabsTrigger> : null}
          {!championOnly ? <TabsTrigger value="assignments">Assignments</TabsTrigger> : null}
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>
        {!championOnly ? (
        <>
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
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <AssignmentImportDialog />
            <Button render={<Link href="/trainer/content/assignments/new" />}>New assignment</Button>
          </div>
          <DataTable
            rowKey="id"
            columns={[
              { key: "code", header: "Code" },
              { key: "title", header: "Title" },
              { key: "moduleCode", header: "Module" },
              { key: "passMarkPct", header: "Pass mark" },
              { key: "submissionTypes", header: "Submission types", wrap: true },
              { key: "departmentCode", header: "Department" },
              { key: "version", header: "Version" },
              { key: "statusLabel", header: "Status" },
              { key: "testOutLabel", header: "Test-out" },
            ]}
            rows={assignments.map((row) => ({
              id: row.id,
              code: row.code,
              title: row.title,
              moduleCode: row.moduleCode,
              passMarkPct: row.passMarkPct,
              submissionTypes: row.submissionTypes,
              departmentCode: row.departmentCode,
              version: String(row.version),
              statusLabel: row.statusLabel,
              testOutLabel: row.isTestOut ? "Yes" : "No",
            }))}
            caption="Assignments"
            exportFileName="assignments-content.csv"
            filters={[{ key: "statusLabel", label: "Status" }, { key: "moduleCode", label: "Module" }]}
            rowActions={(row) => (
              <div className="flex flex-wrap gap-1">
                <Button variant="outline" size="sm" render={<Link href={`/trainer/content/assignments/${row.id}`} />}>
                  Edit
                </Button>
                {row.statusLabel === "Draft" ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      void publishAssignment({
                        id: row.id,
                        changeNote: "Published from content screen.",
                      }).then((result) => {
                        if (result.ok) {
                          window.location.reload();
                        }
                      })
                    }
                  >
                    Publish
                  </Button>
                ) : null}
              </div>
            )}
          />
        </TabsContent>
        </>
        ) : null}
        <TabsContent value="prompts" className="space-y-6">
          {!championOnly ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-heading">Review queue</h2>
            <PromptReviewPanel items={reviewQueue} />
          </section>
          ) : null}
          <section className="space-y-3">
            <div className="flex flex-wrap justify-end gap-2">
              {!championOnly ? (
              <PromptImportDialog
                departmentCodes={promptImportCodes.departmentCodes}
                moduleCodes={promptImportCodes.moduleCodes}
              />
              ) : null}
              <Button render={<Link href="/trainer/content/prompts/new" />}>New prompt</Button>
            </div>
            <DataTable
              rowKey="id"
              columns={[
                { key: "title", header: "Title", wrap: true },
                { key: "department", header: "Department" },
                { key: "taskType", header: "Task" },
                { key: "tool", header: "Tool" },
                { key: "riskTier", header: "Risk" },
                { key: "status", header: "Status" },
                { key: "version", header: "Version" },
                { key: "owner", header: "Owner" },
                { key: "copies", header: "Copies" },
                { key: "feedbackWorked", header: "Worked" },
                { key: "feedbackEdits", header: "Needed edits" },
                { key: "feedbackFailed", header: "Did not work" },
                { key: "lastTested", header: "Last tested" },
              ]}
              rows={prompts}
              caption="Prompt library (trainer view)"
              exportFileName="prompts-trainer.csv"
              filters={[{ key: "status", label: "Status" }, { key: "department", label: "Department" }]}
              rowActions={(row) => (
                <Button variant="outline" size="sm" render={<Link href={`/trainer/content/prompts/${row.id}`} />}>
                  Edit
                </Button>
              )}
            />
          </section>
        </TabsContent>
        <TabsContent value="skills" className="space-y-8">
          {!championOnly ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-heading">Approvals queue</h2>
            <SkillApprovalPanel items={skillApprovalQueue} />
          </section>
          ) : null}
          <section className="space-y-3">
            <DataTable
              rowKey="id"
              columns={[
                { key: "name", header: "Name" },
                { key: "department", header: "Department" },
                { key: "owner", header: "Owner" },
                { key: "status", header: "Status" },
                { key: "version", header: "Version" },
                { key: "tests", header: "Tests passed / total" },
                { key: "headApproval", header: "Dept head" },
                { key: "trainerApproval", header: "Trainer" },
                { key: "liveSince", header: "Live since" },
                { key: "usageCount", header: "Uses" },
                { key: "distinctPeople", header: "People" },
                { key: "distinctDays", header: "Days with use" },
              ]}
              rows={skills}
              caption="Skills catalogue (trainer view)"
              exportFileName="skills-trainer.csv"
              filters={[{ key: "status", label: "Status" }, { key: "department", label: "Department" }]}
              rowActions={(row) => (
                <Button variant="outline" size="sm" render={<Link href={`/trainer/content/skills/${row.id}`} />}>
                  Edit
                </Button>
              )}
            />
          </section>
          {!championOnly ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-heading">Department certification evidence</h2>
            <SkillCertificationPanel rows={certificationEvidence} />
          </section>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
