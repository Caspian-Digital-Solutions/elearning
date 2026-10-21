"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { FormError } from "@/components/shared/form-error";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { streamNames, streamValues } from "@/lib/people/labels";
import type { PlacementTableRow } from "@/lib/assessments/queries";
import {
  allowAssessmentRetake,
  calculatePlacement,
  confirmPlacement,
} from "@/app/(app)/trainer/(restricted)/placements/placement-actions";

export function PlacementsScreen({
  placementRows,
  profileRows,
  notStartedRows,
  assessmentId,
}: {
  placementRows: PlacementTableRow[];
  profileRows: { question: string; option: string; count: number; department: string }[];
  notStartedRows: { name: string; department: string; lastSeen: string }[];
  assessmentId: string | null;
}) {
  const [confirmAttempt, setConfirmAttempt] = useState<PlacementTableRow | null>(null);
  const [stream, setStream] = useState<string>("foundation");
  const [reason, setReason] = useState("");
  const [portfolio, setPortfolio] = useState(false);
  const [retakeUser, setRetakeUser] = useState<{ userId: string; name: string } | null>(null);
  const [retakeReason, setRetakeReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runCalculate = (attemptId: string) => {
    startTransition(async () => {
      const result = await calculatePlacement(attemptId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Placement calculated.");
      window.location.reload();
    });
  };

  const runConfirm = () => {
    if (!confirmAttempt) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await confirmPlacement({
        attemptId: confirmAttempt.attemptId,
        stream: stream as (typeof streamValues)[number],
        reason: reason || undefined,
        portfolioReviewed: portfolio,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Placement confirmed.");
      setConfirmAttempt(null);
      window.location.reload();
    });
  };

  const runRetake = () => {
    if (!retakeUser || !assessmentId) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await allowAssessmentRetake({
        userId: retakeUser.userId,
        assessmentId,
        reason: retakeReason,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Retake allowed.");
      setRetakeUser(null);
      window.location.reload();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Placements"
        purpose="Calculate Week 0 placement, review domain scores, and confirm streams."
      />
      <Tabs defaultValue="placements">
        <TabsList>
          <TabsTrigger value="placements">Placements</TabsTrigger>
          <TabsTrigger value="profile">Profile answers</TabsTrigger>
          <TabsTrigger value="not-started">Not started</TabsTrigger>
        </TabsList>
        <TabsContent value="placements" className="space-y-4">
          <DataTable
            rowKey="attemptId"
            caption="Submitted Week 0 attempts"
            exportFileName="placements.csv"
            columns={[
              { key: "personName", header: "Person" },
              { key: "department", header: "Department" },
              { key: "submittedAt", header: "Submitted" },
              { key: "markingProgress", header: "Marking" },
              { key: "total", header: "Total" },
              { key: "suggestedStream", header: "Suggested" },
              { key: "confirmedStream", header: "Confirmed" },
            ]}
            rows={placementRows.map((row) => ({
              attemptId: row.attemptId,
              userId: row.userId,
              personName: row.personName,
              department: row.department,
              submittedAt: row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—",
              markingProgress: row.markingProgress,
              total: row.total,
              suggestedStream: row.suggestedStream,
              confirmedStream: row.confirmedStream,
              fullyMarked: row.fullyMarked ? "yes" : "no",
              hasPlacement: row.hasPlacement ? "yes" : "no",
              confirmedAt: row.confirmedAt,
            }))}
            rowActions={(row) => {
              const source = placementRows.find((entry) => entry.attemptId === row.attemptId);
              if (!source) {
                return null;
              }
              return (
                <div className="flex flex-wrap gap-1">
                  {source.fullyMarked && !source.confirmedAt ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => runCalculate(source.attemptId)}>
                      Calculate
                    </Button>
                  ) : null}
                  {source.hasPlacement && !source.confirmedAt ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setConfirmAttempt(source);
                        setStream(streamValues[0]);
                        setReason("");
                        setPortfolio(false);
                      }}
                    >
                      Confirm
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRetakeUser({ userId: source.userId, name: source.personName })}
                  >
                    Retake
                  </Button>
                </div>
              );
            }}
          />
        </TabsContent>
        <TabsContent value="profile">
          <DataTable
            rowKey="id"
            caption="Profile question aggregates"
            exportFileName="profile-answers.csv"
            columns={[
              { key: "question", header: "Question" },
              { key: "option", header: "Answer" },
              { key: "department", header: "Department" },
              { key: "count", header: "Count" },
            ]}
            rows={profileRows.map((row, index) => ({ ...row, id: String(index), count: String(row.count) }))}
          />
        </TabsContent>
        <TabsContent value="not-started">
          <DataTable
            rowKey="name"
            caption="Active learners without a Week 0 submission"
            exportFileName="week0-not-started.csv"
            columns={[
              { key: "name", header: "Person" },
              { key: "department", header: "Department" },
              { key: "lastSeen", header: "Last seen" },
            ]}
            rows={notStartedRows}
          />
        </TabsContent>
      </Tabs>

      {confirmAttempt ? (
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Confirm placement for {confirmAttempt.personName}</h2>
          <FormError>{error}</FormError>
          <div className="space-y-1">
            <Label>Stream</Label>
            <NativeSelect value={stream} onChange={(e) => setStream(e.target.value)}>
              {streamValues.map((value) => (
                <option key={value} value={value}>{streamNames[value]}</option>
              ))}
            </NativeSelect>
          </div>
          <Textarea
            placeholder="Reason if overriding the suggestion"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={portfolio} onChange={(e) => setPortfolio(e.target.checked)} />
            Portfolio reviewed (required for Champion)
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmAttempt(null)}>Cancel</Button>
            <Button type="button" disabled={pending} onClick={runConfirm}>Confirm stream</Button>
          </div>
        </div>
      ) : null}

      {retakeUser ? (
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Allow retake for {retakeUser.name}</h2>
          <FormError>{error}</FormError>
          <Textarea
            placeholder="Reason (at least ten characters)"
            value={retakeReason}
            onChange={(e) => setRetakeReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setRetakeUser(null)}>Cancel</Button>
            <Button type="button" disabled={pending} onClick={runRetake}>Allow retake</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
