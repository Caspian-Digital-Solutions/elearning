import { formatDate } from "@/lib/format";
import type { SkillApprovalRow, SkillStatus } from "@/lib/skills/types";

const statusLabels: Record<SkillStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  live: "Live",
  retired: "Retired",
};

export function skillStatusLabel(status: SkillStatus): string {
  return statusLabels[status] ?? status;
}

export function canEditUsageLog(createdAt: string, now = Date.now()): boolean {
  const created = new Date(createdAt).getTime();
  return now - created < 24 * 60 * 60 * 1000;
}

export function formatApprovalLine(approval: SkillApprovalRow, approverName: string): string {
  return `${approverName} (${approval.approver_role.replace("_", " ")}) — ${approval.decision} on ${formatDate(approval.decided_at)}`;
}
