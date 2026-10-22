import { markPercentage } from "@/lib/assignments/validators";
import type { SubmissionStatus } from "@/lib/assignments/types";

export type LearnerAssignmentStatus =
  | "not_started"
  | "submitted"
  | "being_marked"
  | "feedback_ready"
  | "resubmit_requested";

export function learnerAssignmentStatusLabel(status: LearnerAssignmentStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "submitted":
      return "Submitted";
    case "being_marked":
      return "Being marked";
    case "feedback_ready":
      return "Feedback ready";
    case "resubmit_requested":
      return "Resubmission requested";
    default:
      return status;
  }
}

export function deriveLearnerAssignmentStatus(
  latestStatus: SubmissionStatus | null,
): LearnerAssignmentStatus {
  if (!latestStatus) {
    return "not_started";
  }
  switch (latestStatus) {
    case "submitted":
      return "submitted";
    case "in_review":
      return "being_marked";
    case "returned":
      return "feedback_ready";
    case "resubmit_requested":
      return "resubmit_requested";
    case "withdrawn":
      return "not_started";
    default:
      return "not_started";
  }
}

export function formatReleasedMark(total: number, maxTotal: number): string {
  const pct = Math.round(markPercentage(total, maxTotal));
  return `${total} of ${maxTotal} (${pct}%)`;
}
