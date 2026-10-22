"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MarkingQueueRow as Week0Row } from "@/lib/assessments/queries";
import type { MarkingQueueRow as AssignmentRow, ModerationRow } from "@/lib/assignments/queries";
import { MarkingScreen } from "@/app/(app)/trainer/marking/marking-screen";
import { AssignmentMarkingPanel } from "@/app/(app)/trainer/marking/assignment-marking-panel";
import { ModerationPanel } from "@/app/(app)/trainer/marking/moderation-panel";

export function MarkingHubScreen({
  week0Queue,
  assignmentQueue,
  moderationRows,
  assignmentOptions,
  canModerate,
  defaultTab = "week0",
}: {
  week0Queue: Week0Row[];
  assignmentQueue: AssignmentRow[];
  moderationRows: ModerationRow[];
  assignmentOptions: { id: string; label: string }[];
  canModerate: boolean;
  defaultTab?: "week0" | "assignments" | "moderation";
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Marking queue"
        purpose="Week 0 placement, module assignments and double-mark moderation."
      />
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="week0">Week 0</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          {canModerate ? <TabsTrigger value="moderation">Moderation</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="week0">
          <MarkingScreen initialQueue={week0Queue} embedded />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentMarkingPanel initialQueue={assignmentQueue} canModerate={canModerate} />
        </TabsContent>
        {canModerate ? (
          <TabsContent value="moderation">
            <ModerationPanel rows={moderationRows} assignmentOptions={assignmentOptions} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
