import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getLearnerAssignmentDetail } from "@/lib/assignments/queries";
import { AssignmentDetailScreen } from "@/app/(app)/assignments/assignment-detail-screen";

export const metadata: Metadata = {
  title: "Assignment",
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading.</p>}>
      <AssignmentPage params={params} />
    </Suspense>
  );
}

async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const detail = await getLearnerAssignmentDetail(user.id, id);
  if (!detail) {
    return (
      <div className="space-y-4">
        <PageHeader title="Assignment not found" purpose="This assignment is not on your plan or is not published." />
        <Button variant="outline" render={<Link href="/assignments" />}>Back to assignments</Button>
      </div>
    );
  }
  return <AssignmentDetailScreen detail={detail} />;
}
