export const submissionTypes = ["link", "file", "text"] as const;
export type SubmissionType = (typeof submissionTypes)[number];

export const submissionStatuses = [
  "submitted",
  "in_review",
  "returned",
  "resubmit_requested",
  "withdrawn",
] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];

export const reviewKinds = ["primary", "double_mark", "final"] as const;
export type ReviewKind = (typeof reviewKinds)[number];

export const allowedSubmissionLinkHosts = [
  "claude.ai",
  "docs.google.com",
  "drive.google.com",
] as const;

export type ModuleAssignmentRequirement = {
  passMarkPct: number;
  maxTotal: number;
  releasedTotal: number | null;
};

export type ReviewTotals = {
  kind: ReviewKind;
  total: number;
};
