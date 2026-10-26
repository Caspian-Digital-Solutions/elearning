export type SkillStatus = "draft" | "in_review" | "approved" | "live" | "retired";
export type SkillUsageOutcome = "kept" | "edited" | "discarded";
export type SkillApprovalDecision = "approved" | "changes_requested";

export type SkillRow = {
  id: string;
  name: string;
  display_name: string;
  department_id: string;
  owner_id: string | null;
  description: string;
  status: SkillStatus;
  current_version: string;
  review_version_id: string | null;
  how_to_enable_md: string;
  boundaries_md: string;
  is_certification_skill: boolean;
  live_since: string | null;
  retired_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type SkillVersionRow = {
  id: string;
  skill_id: string;
  version: string;
  changelog_md: string;
  skill_md_text: string;
  test_cases_count: number;
  test_cases_passed: number;
  tested_by: string | null;
  tested_at: string | null;
  test_notes_md: string | null;
  created_by: string;
  created_at: string;
};

export type SkillApprovalRow = {
  id: string;
  skill_version_id: string;
  approver_id: string;
  approver_role: "department_head" | "trainer" | "governance";
  decision: SkillApprovalDecision;
  comment_md: string;
  decided_at: string;
};

export type SkillUsageLogRow = {
  id: string;
  skill_id: string;
  skill_version: string;
  user_id: string;
  used_on: string;
  task: string;
  outcome: SkillUsageOutcome;
  minutes_saved: number | null;
  declaration: boolean;
  created_at: string;
};
